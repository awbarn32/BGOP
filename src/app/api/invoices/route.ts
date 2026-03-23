import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

const INVOICE_SELECT = `
  id, job_id, customer_id, vehicle_id, revenue_stream, invoice_number,
  invoice_date, status, total_amount, deposit_amount, deposit_paid_at,
  paid_amount, payment_method, paid_at, notes, created_at, updated_at,
  customer:customers(id, full_name, phone, line_id),
  vehicle:vehicles(id, make, model, year, license_plate),
  job:jobs(id, description, bucket, status)
`

const CreateInvoiceSchema = z.object({
  job_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid(),
  vehicle_id: z.string().uuid().nullable().optional(),
  revenue_stream: z.enum(['service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel']),
  invoice_date: z.string().date(),
  status: z.enum(['quote', 'approved', 'deposit_paid', 'pending', 'paid', 'void']).default('quote'),
  total_amount: z.number().nonnegative(),
  deposit_amount: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? ''
  const customer_id = searchParams.get('customer_id') ?? ''
  const job_id = searchParams.get('job_id') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50', 10))

  let query = supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) query = query.eq('status', status)
  if (customer_id) query = query.eq('customer_id', customer_id)
  if (job_id) query = query.eq('job_id', job_id)
  if (from) query = query.gte('invoice_date', from)
  if (to) query = query.lte('invoice_date', to)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateInvoiceSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      job_id: parsed.data.job_id ?? null,
      customer_id: parsed.data.customer_id,
      vehicle_id: parsed.data.vehicle_id ?? null,
      revenue_stream: parsed.data.revenue_stream,
      invoice_date: parsed.data.invoice_date,
      status: parsed.data.status,
      total_amount: parsed.data.total_amount,
      deposit_amount: parsed.data.deposit_amount ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select(INVOICE_SELECT)
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
