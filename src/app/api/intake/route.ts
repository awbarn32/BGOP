import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { validationError, serverError } from '@/lib/utils/validation'

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 5

const phoneCounts = new Map<string, { count: number; resetAt: number }>()

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').trim()
}

function checkPhoneRateLimit(phone: string): boolean {
  const now = Date.now()
  const entry = phoneCounts.get(phone)
  if (!entry || now > entry.resetAt) {
    phoneCounts.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

const LookupSchema = z.object({
  phone: z.string().min(6).max(20),
})

const IntakeSchema = z.object({
  full_name: z.string().min(1).max(255),
  phone: z.string().min(6).max(20),
  line_id: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  preferred_language: z.enum(['en', 'th']).default('th'),
  consent_to_message: z.boolean().default(false),
  vehicle_id: z.string().uuid().nullable().optional(),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  color: z.string().max(50).nullable().optional(),
  license_plate: z.string().max(20).nullable().optional(),
  current_mileage: z.number().int().nonnegative().nullable().optional(),
  service_type: z.enum([
    'service', 'transport', 'dlt', 'sourcing', 'ecu', 'track_day', 'bike_hotel', 'other',
  ]),
  description: z.string().min(5).max(2000),
  logistics_type: z.enum(['drop_off', 'pickup']).nullable().optional(),
  pickup_address: z.string().max(2000).nullable().optional(),
  preferred_date: z.string().date().nullable().optional(),
  intake_photos: z.array(z.string().min(1).max(400000)).max(4).nullable().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = LookupSchema.safeParse({ phone: searchParams.get('phone') ?? '' })
  if (!parsed.success) return validationError('Phone is required')

  const supabase = createAdminClient()
  const normalizedPhone = normalizePhone(parsed.data.phone)

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, preferred_language, vehicles(id, make, model, year, license_plate, color, current_mileage)')
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (error) return serverError(error.message)
  return Response.json({ data: customer ?? null })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = IntakeSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const d = parsed.data
  const normalizedPhone = normalizePhone(d.phone)
  if (!checkPhoneRateLimit(normalizedPhone)) {
    return Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests for this phone number. Please try again later.' } },
      { status: 429 }
    )
  }

  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const supabase = createAdminClient()

  const { data: existingCustomer, error: existingCustomerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (existingCustomerError) return serverError(existingCustomerError.message)

  let customerId = existingCustomer?.id ?? null

  if (customerId) {
    const { error } = await supabase
      .from('customers')
      .update({
        full_name: d.full_name,
        phone: normalizedPhone,
        line_id: d.line_id ?? null,
        email: d.email ?? null,
        preferred_language: d.preferred_language,
        consent_to_message: d.consent_to_message,
      })
      .eq('id', customerId)

    if (error) return serverError(error.message)
  } else {
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        full_name: d.full_name,
        phone: normalizedPhone,
        line_id: d.line_id ?? null,
        email: d.email ?? null,
        preferred_language: d.preferred_language,
        consent_to_message: d.consent_to_message,
        acquisition_source: 'walk_in',
      })
      .select('id')
      .single()

    if (error || !customer) return serverError(error?.message ?? 'Failed to save customer')
    customerId = customer.id
  }

  let vehicleId = d.vehicle_id ?? null

  if (vehicleId) {
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('id, customer_id')
      .eq('id', vehicleId)
      .single()

    if (error || !vehicle || vehicle.customer_id !== customerId) {
      return validationError('Selected vehicle does not belong to this customer')
    }
  } else {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, make, model, year, license_plate')
      .eq('customer_id', customerId)

    if (error) return serverError(error.message)

    const normalizedModel = d.model.trim().toLowerCase()
    const normalizedPlate = d.license_plate?.trim().toLowerCase() ?? null

    const matchedVehicle = (vehicles ?? []).find((vehicle) => {
      if (normalizedPlate && vehicle.license_plate?.trim().toLowerCase() === normalizedPlate) {
        return true
      }

      return (
        vehicle.make.trim().toLowerCase() === d.make.trim().toLowerCase() &&
        vehicle.model.trim().toLowerCase() === normalizedModel &&
        vehicle.year === d.year
      )
    })

    if (matchedVehicle) {
      vehicleId = matchedVehicle.id

      const { error: updateVehicleError } = await supabase
        .from('vehicles')
        .update({
          color: d.color ?? null,
          license_plate: d.license_plate ?? null,
          current_mileage: d.current_mileage ?? null,
        })
        .eq('id', matchedVehicle.id)

      if (updateVehicleError) return serverError(updateVehicleError.message)
    } else {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          customer_id: customerId,
          make: d.make.trim().toLowerCase(),
          model: d.model.trim(),
          year: d.year,
          color: d.color ?? null,
          license_plate: d.license_plate ?? null,
          current_mileage: d.current_mileage ?? null,
        })
        .select('id')
        .single()

      if (vehicleError || !vehicle) {
        return serverError(vehicleError?.message ?? 'Failed to save vehicle')
      }
      vehicleId = vehicle.id
    }
  }

  const revenueStream = d.service_type === 'other' ? null : d.service_type
  const preferredDateNote = d.preferred_date
    ? `\n\nวันที่ต้องการ / Preferred date: ${d.preferred_date}`
    : ''

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      customer_id: customerId,
      vehicle_id: vehicleId,
      bucket: 'new_requests',
      status: 'new',
      description: `${d.description}${preferredDateNote}`,
      logistics_type: d.logistics_type ?? null,
      revenue_stream: revenueStream,
      pickup_address: d.logistics_type === 'pickup' ? d.pickup_address ?? null : null,
      intake_mileage: d.current_mileage ?? null,
      intake_photos: d.intake_photos ?? null,
    })
    .select('id')
    .single()

  if (jobError || !job) return serverError(jobError?.message ?? 'Failed to create job')

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      job_id: job.id,
      customer_id: customerId,
      vehicle_id: vehicleId,
      revenue_stream: revenueStream ?? 'service',
      status: 'quote',
      total_amount: 0,
      invoice_date: new Date().toISOString().slice(0, 10),
      notes: forwardedFor ? `Intake submitted from IP: ${forwardedFor}` : null,
    })
    .select('id')
    .single()

  if (invoiceError || !invoice) return serverError(invoiceError?.message ?? 'Failed to create invoice')

  return Response.json(
    { data: { job_id: job.id, customer_id: customerId, vehicle_id: vehicleId, invoice_id: invoice.id } },
    { status: 201 }
  )
}
