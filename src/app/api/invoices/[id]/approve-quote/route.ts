/**
 * POST /api/invoices/[id]/approve-quote
 *
 * Owner approves a quote/invoice pending their review.
 * - Requires Owner role only
 * - Invoice must be in 'pending_owner_approval' status
 * - Sets status → 'approved', records approved_by + approved_at
 * - Sends the quote to the customer via LINE
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
  if (role !== 'owner') {
    return NextResponse.json({ error: { message: 'Forbidden — Owner only' } }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch invoice + job relations
  const { data: invoice, error: fetchErr } = await admin
    .from('invoices')
    .select(`
      id, status, job_id, total_amount,
      job:jobs(
        id, status,
        customer:customers(id, full_name, line_id, preferred_language, consent_to_message),
        vehicle:vehicles(make, model, year)
      )
    `)
    .eq('id', id)
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: { message: 'Invoice not found' } }, { status: 404 })
  }

  if (invoice.status !== 'pending_owner_approval') {
    return NextResponse.json(
      { error: { message: `Cannot approve from status '${invoice.status}'` } },
      { status: 422 }
    )
  }

  // Update invoice to approved
  const { data: updated, error: updateErr } = await admin
    .from('invoices')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: { message: updateErr.message } }, { status: 500 })
  }

  // Also update the job status to quote_sent (quote was approved and is now going to customer)
  const job = invoice.job as unknown as {
    id: string
    status: string
    customer: { id: string; full_name: string; line_id: string | null; preferred_language: string | null; consent_to_message: boolean }
    vehicle: { make: string; model: string; year: number }
  } | null

  if (job) {
    await admin
      .from('jobs')
      .update({ status: 'quote_sent' })
      .eq('id', job.id)

    // Send quote to customer via LINE (non-blocking)
    try {
      if (job.customer.line_id && job.customer.consent_to_message) {
        const { sendLineMessage } = await import('@/lib/messaging/service')
        const lang = (job.customer.preferred_language as 'th' | 'en' | null) ?? null
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const quoteUrl = `${appUrl}/quote/${job.id}`

        let text: string
        if (lang === 'th') {
          text =
            `สวัสดีครับคุณ ${job.customer.full_name}\n\n` +
            `บัตเลอร์ การาจ ได้เตรียมใบประเมินราคาสำหรับท่านเรียบร้อยแล้ว\n` +
            `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}\n` +
            `รวม: ฿${invoice.total_amount?.toLocaleString() ?? '—'}\n\n` +
            `ดูรายละเอียดและยืนยันได้ที่:\n${quoteUrl}\n\n` +
            `—\nButler Garage | Bangkok`
        } else if (lang === 'en') {
          text =
            `Hi ${job.customer.full_name},\n\n` +
            `Butler Garage has prepared your service estimate.\n` +
            `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}\n` +
            `Total: ฿${invoice.total_amount?.toLocaleString() ?? '—'}\n\n` +
            `Review and authorize here:\n${quoteUrl}\n\n` +
            `—\nButler Garage | Bangkok`
        } else {
          // Bilingual
          text =
            `สวัสดีครับคุณ ${job.customer.full_name} / Hi ${job.customer.full_name},\n\n` +
            `บัตเลอร์ การาจ ได้เตรียมใบประเมินราคาสำหรับท่าน / Butler Garage has prepared your estimate.\n` +
            `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}\n` +
            `รวม / Total: ฿${invoice.total_amount?.toLocaleString() ?? '—'}\n\n` +
            `${quoteUrl}\n\n` +
            `—\nButler Garage | Bangkok`
        }

        await sendLineMessage({
          customerId: job.customer.id,
          jobId: job.id,
          messageType: 'quote_approved',
          messages: [{ type: 'text', text }],
          skipChecks: true,
        })
      }
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({ data: updated })
}
