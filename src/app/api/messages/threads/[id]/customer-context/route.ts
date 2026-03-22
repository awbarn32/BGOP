import { createClient } from '@/lib/supabase/server'
import {
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  const { data: thread, error: threadErr } = await supabase
    .from('conversation_threads')
    .select('customer_id')
    .eq('id', id)
    .single()

  if (threadErr) return serverError(threadErr.message)
  if (!thread?.customer_id) return notFoundError('Thread')

  const customerId = thread.customer_id

  const [
    { data: customer, error: customerErr },
    { data: vehicles, error: vehiclesErr },
    { data: jobs, error: jobsErr },
    { data: invoices, error: invoicesErr },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name, phone, email, line_id, line_display_name, line_picture_url, preferred_language, consent_to_message, dormant, acquisition_source, notes, created_at')
      .eq('id', customerId)
      .single(),
    supabase
      .from('vehicles')
      .select('id, make, model, year, license_plate, color, current_mileage, ownership_status')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('jobs')
      .select('id, bucket, status, description, revenue_stream, created_at')
      .eq('customer_id', customerId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total_amount, deposit_amount, paid_amount, invoice_date')
      .eq('customer_id', customerId)
      .in('status', ['quote', 'approved', 'deposit_paid', 'pending'])
      .order('invoice_date', { ascending: false })
      .limit(5),
  ])

  const firstError = customerErr ?? vehiclesErr ?? jobsErr ?? invoicesErr
  if (firstError) return serverError(firstError.message)
  if (!customer) return notFoundError('Customer')

  const outstandingBalance = (invoices ?? []).reduce((sum, invoice) => {
    const totalAmount = Number(invoice.total_amount ?? 0)
    const depositAmount = Number(invoice.deposit_amount ?? 0)
    const paidAmount = Number(invoice.paid_amount ?? 0)
    const due = totalAmount - depositAmount - paidAmount
    return sum + Math.max(0, due)
  }, 0)

  return Response.json({
    data: {
      customer,
      vehicles: vehicles ?? [],
      recent_jobs: jobs ?? [],
      outstanding_invoices: invoices ?? [],
      outstanding_balance: outstandingBalance,
    },
  })
}
