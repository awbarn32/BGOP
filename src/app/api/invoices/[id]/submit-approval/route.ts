/**
 * POST /api/invoices/[id]/submit-approval
 *
 * PA submits a quote/invoice for Owner review.
 * - Requires PA or Owner role
 * - Invoice must be in 'quote' or 'owner_declined' status
 * - Sets status → 'pending_owner_approval'
 * - Notifies Owner via LINE (if configured)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const role = user.app_metadata?.role as string
  if (role !== 'pa' && role !== 'owner') {
    return NextResponse.json({ error: { message: 'Forbidden — PA or Owner only' } }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch invoice to validate current status
  const { data: invoice, error: fetchErr } = await admin
    .from('invoices')
    .select('id, status, job_id, total_amount, job:jobs(customer:customers(full_name), vehicle:vehicles(make, model, year))')
    .eq('id', id)
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: { message: 'Invoice not found' } }, { status: 404 })
  }

  const allowedStatuses = ['quote', 'owner_declined']
  if (!allowedStatuses.includes(invoice.status)) {
    return NextResponse.json(
      { error: { message: `Cannot submit for approval from status '${invoice.status}'` } },
      { status: 422 }
    )
  }

  // Fetch submitting user's name
  const { data: submitter } = await admin
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Update invoice status
  const { data: updated, error: updateErr } = await admin
    .from('invoices')
    .update({
      status: 'pending_owner_approval',
      submitted_for_approval_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: { message: updateErr.message } }, { status: 500 })
  }

  // Notify Owner via LINE (non-blocking — if it fails, submission still succeeds)
  try {
    const job = invoice.job as { customer: { full_name: string }; vehicle: { make: string; model: string; year: number } } | null
    if (job) {
      const { data: owners } = await admin
        .from('users')
        .select('line_id')
        .eq('role', 'owner')
        .not('line_id', 'is', null)

      if (owners && owners.length > 0) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const msgText =
          `🔧 Butler Garage — Approval Request\n\n` +
          `New quote submitted for review:\n` +
          `Customer: ${job.customer.full_name}\n` +
          `Vehicle: ${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}\n` +
          `Total: ฿${invoice.total_amount?.toLocaleString() ?? '—'}\n` +
          `Submitted by: ${submitter?.full_name ?? 'PA'}\n\n` +
          `Tap to review → ${appUrl}/approvals`

        const { pushMessage } = await import('@/lib/line/client')
        await Promise.allSettled(
          owners.map((o) => pushMessage(o.line_id!, [{ type: 'text', text: msgText }]))
        )
      }
    }
  } catch {
    // Non-critical — swallow
  }

  return NextResponse.json({ data: updated })
}
