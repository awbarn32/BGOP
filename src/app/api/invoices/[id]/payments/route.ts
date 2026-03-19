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

const RecordPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'bank_transfer', 'promptpay', 'credit_card', 'other']),
  paid_at: z.string().datetime().optional(),
  deposit: z.boolean().default(false), // true = record as deposit, false = final payment
})

// POST /api/invoices/[id]/payments — record a payment (deposit or final)
export async function POST(request: Request, { params }: Params) {
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

  const parsed = RecordPaymentSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Fetch current invoice
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, total_amount, deposit_amount, paid_amount')
    .eq('id', id)
    .single()

  if (fetchError || !invoice) return notFoundError('Invoice')
  if (invoice.status === 'void') return validationError('Cannot record payment on a voided invoice')

  const paidAt = parsed.data.paid_at ?? new Date().toISOString()

  let updatePayload: Record<string, unknown>

  if (parsed.data.deposit) {
    updatePayload = {
      deposit_amount: parsed.data.amount,
      deposit_paid_at: paidAt,
      payment_method: parsed.data.payment_method,
      status: 'deposit_paid',
    }
  } else {
    updatePayload = {
      paid_amount: parsed.data.amount,
      payment_method: parsed.data.payment_method,
      paid_at: paidAt,
      status: 'paid',
    }
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updatePayload)
    .eq('id', id)
    .select(`
      id, job_id, customer_id, status, total_amount, deposit_amount,
      deposit_paid_at, paid_amount, payment_method, paid_at
    `)
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
