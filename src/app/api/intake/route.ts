import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { validationError, serverError } from '@/lib/utils/validation'
import { headers } from 'next/headers'

// ─── Rate limiting (simple in-memory per IP, resets on cold start) ──────────
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 5 // max submissions per IP per window

const ipCounts = new Map<string, { count: number; resetAt: number }>()

// Normalize phone: strip all non-digits, convert +66 prefix to 0
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('66') && digits.length > 9) {
    digits = '0' + digits.slice(2)
  }
  return digits
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ─── Schema ─────────────────────────────────────────────────────────────────
const IntakeSchema = z.object({
  // Contact
  full_name: z.string().min(1).max(255),
  phone: z.string().min(6).max(20),
  line_id: z.string().max(100).nullable().optional(),
  preferred_language: z.enum(['en', 'th']).default('th'),
  consent_to_message: z.boolean().default(false),

  // Vehicle
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  license_plate: z.string().max(20).nullable().optional(),
  current_mileage: z.number().int().nonnegative().nullable().optional(),

  // Service request
  service_type: z.enum([
    'service', 'transport', 'dlt', 'sourcing', 'ecu', 'track_day', 'bike_hotel', 'other'
  ]),
  description: z.string().min(5).max(2000),
  logistics_type: z.enum(['drop_off', 'pickup']).nullable().optional(),
  preferred_date: z.string().date().nullable().optional(),
})

export async function POST(request: Request) {
  // Rate limit by IP
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = IntakeSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const d = parsed.data
  const supabase = createAdminClient()

  // Normalize phone before matching
  const phone = normalizePhone(d.phone)

  // 1. Upsert customer by phone number (phone is the natural key for intake)
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .upsert(
      {
        full_name: d.full_name,
        phone,
        line_id: d.line_id ?? null,
        preferred_language: d.preferred_language,
        consent_to_message: d.consent_to_message,
        acquisition_source: 'walk_in', // intake form = walk-in / self-service
      },
      { onConflict: 'phone', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (customerError || !customer) return serverError(customerError?.message ?? 'Failed to save customer')

  // 2. Insert vehicle
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .insert({
      customer_id: customer.id,
      make: d.make,
      model: d.model,
      year: d.year,
      license_plate: d.license_plate ?? null,
      current_mileage: d.current_mileage ?? null,
    })
    .select('id')
    .single()

  if (vehicleError || !vehicle) return serverError(vehicleError?.message ?? 'Failed to save vehicle')

  // 3. Create job in new_requests bucket
  // service_type 'other' maps to null revenue_stream; remaining values are valid RevenueStream values
  const revenueStream = d.service_type === 'other' ? null : d.service_type
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      bucket: 'new_requests',
      status: 'new',
      description: d.description,
      logistics_type: d.logistics_type ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      revenue_stream: revenueStream as any,
      intake_mileage: d.current_mileage ?? null,
    })
    .select('id')
    .single()

  if (jobError || !job) return serverError(jobError?.message ?? 'Failed to create job')

  // 4. Record preferred date as a note on the job if provided
  if (d.preferred_date) {
    await supabase.from('jobs').update({
      description: `${d.description}\n\nPreferred date (วันที่ต้องการ): ${d.preferred_date}`,
    }).eq('id', job.id)
  }

  // 5. Create an initial draft quote invoice for the job
  await supabase.from('invoices').insert({
    job_id: job.id,
    customer_id: customer.id,
    vehicle_id: vehicle.id,
    revenue_stream: revenueStream,
    status: 'quote',
    total_amount: 0,
    invoice_date: new Date().toISOString().split('T')[0],
  })

  return Response.json(
    { data: { job_id: job.id, customer_id: customer.id } },
    { status: 201 }
  )
}
