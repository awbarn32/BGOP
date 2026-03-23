/**
 * POST /api/invoices/[id]/decline-quote
 *
 * Owner declines a quote pending their review.
 * - Requires Owner role only
 * - Invoice must be in 'pending_owner_approval' status
 * - Body: { reason: string } — required
 * - Sets status → 'owner_declined', stores owner_decline_reason
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const role = user.app_metadata?.role as string
  if (role !== 'owner') {
    return NextResponse.json({ error: { message: 'Forbidden — Owner only' } }, { status: 403 })
  }

  const body = await req.json()
  const reason: string = (body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: { message: 'Decline reason is required' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate current status
  const { data: invoice, error: fetchErr } = await admin
    .from('invoices')
    .select('id, status, job_id')
    .eq('id', id)
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: { message: 'Invoice not found' } }, { status: 404 })
  }

  if (invoice.status !== 'pending_owner_approval') {
    return NextResponse.json(
      { error: { message: `Cannot decline from status '${invoice.status}'` } },
      { status: 422 }
    )
  }

  const { data: updated, error: updateErr } = await admin
    .from('invoices')
    .update({
      status: 'owner_declined',
      owner_decline_reason: reason,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: { message: updateErr.message } }, { status: 500 })
  }

  // Notify PA via LINE (non-blocking)
  try {
    if (invoice.job_id) {
      const { data: job } = await admin
        .from('jobs')
        .select('customer:customers(full_name), vehicle:vehicles(make, model, year)')
        .eq('id', invoice.job_id)
        .single()

      const { data: paUsers } = await admin
        .from('users')
        .select('line_id')
        .eq('role', 'pa')
        .not('line_id', 'is', null)

      if (paUsers && paUsers.length > 0 && job) {
        const j = job as { customer: { full_name: string }; vehicle: { make: string; model: string; year: number } }
        const msgText =
          `🔧 Butler Garage — Quote Declined\n\n` +
          `Customer: ${j.customer.full_name}\n` +
          `Vehicle: ${j.vehicle.year} ${j.vehicle.make} ${j.vehicle.model}\n\n` +
          `Reason: ${reason}\n\n` +
          `Please revise and resubmit.`

        const { pushMessage } = await import('@/lib/line/client')
        await Promise.allSettled(
          paUsers.map((pa) => pushMessage(pa.line_id!, [{ type: 'text', text: msgText }]))
        )
      }
    }
  } catch {
    // Non-critical
  }

  return NextResponse.json({ data: updated })
}
