import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const INVOICE_SELECT = `
  id, job_id, customer_id, vehicle_id, revenue_stream, invoice_number,
  invoice_date, status, total_amount, deposit_amount, deposit_paid_at,
  paid_amount, payment_method, paid_at, notes, created_at, updated_at,
  customer:customers(id, full_name, phone, line_id),
  vehicle:vehicles(id, make, model, year, license_plate),
  job:jobs(id, description, bucket, status)
`

const UpdateInvoiceSchema = z.object({
  revenue_stream: z.enum(['service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel']).optional(),
  invoice_date: z.string().date().optional(),
  status: z.enum(['quote', 'approved', 'deposit_paid', 'pending', 'paid', 'void']).optional(),
  total_amount: z.number().nonnegative().optional(),
  deposit_amount: z.number().nonnegative().nullable().optional(),
  deposit_paid_at: z.string().datetime().nullable().optional(),
  paid_amount: z.number().nonnegative().nullable().optional(),
  payment_method: z.enum(['cash', 'bank_transfer', 'promptpay', 'credit_card', 'other']).nullable().optional(),
  paid_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', id)
    .single()

  if (error || !data) return notFoundError('Invoice')
  return Response.json({ data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
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

  const parsed = UpdateInvoiceSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Auto-set paid_at when status transitions to 'paid'
  const updatePayload: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'paid' && !parsed.data.paid_at) {
    updatePayload.paid_at = new Date().toISOString()
  }
  if (parsed.data.status === 'deposit_paid' && !parsed.data.deposit_paid_at) {
    updatePayload.deposit_paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updatePayload)
    .eq('id', id)
    .select(INVOICE_SELECT)
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Invoice')
  return Response.json({ data })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  // Only owner can void/delete invoices
  if (user.app_metadata?.role !== 'owner') return forbiddenError()

  // Soft delete: set status to void
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'void' })
    .eq('id', id)

  if (error) return serverError(error.message)
  return new Response(null, { status: 204 })
}
