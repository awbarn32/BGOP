// POST /api/quote/[id]/approve — PUBLIC (no auth required)
// Customer approves or declines the quote.
// id = job_id
// Body: { action: 'approve' | 'decline' }

import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const BodySchema = z.object({
  action: z.enum(['approve', 'decline']),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}))
  const parse = BodySchema.safeParse(body)
  if (!parse.success) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } }, { status: 400 })
  }

  const { action } = parse.data
  const admin = createAdminClient()

  // Verify job exists and is in quote/quote_sent status
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, status, invoice:invoices(id, status)')
    .eq('id', params.id)
    .single()

  if (jobErr || !job) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Job not found' } }, { status: 404 })
  }

  const invoiceArr = job.invoice as Array<{ id: string; status: string }>
  const invoice = invoiceArr?.[0]

  if (!invoice) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, { status: 404 })
  }

  // Only allow approval when job is in quote/quote_sent status
  if (!['new', 'under_review', 'awaiting_customer', 'quote_sent'].includes(job.status)) {
    return Response.json(
      { error: { code: 'INVALID_STATE', message: 'Quote is no longer available for action' } },
      { status: 409 }
    )
  }

  if (action === 'approve') {
    // Move job to confirmed, invoice to approved
    const [jobUpdate, invoiceUpdate] = await Promise.all([
      admin.from('jobs').update({ status: 'confirmed' }).eq('id', params.id),
      admin.from('invoices').update({ status: 'approved' }).eq('id', invoice.id),
    ])
    if (jobUpdate.error || invoiceUpdate.error) {
      return Response.json({ error: { code: 'DB_ERROR', message: 'Failed to approve' } }, { status: 500 })
    }
    return Response.json({ data: { action: 'approved' } })
  } else {
    // Decline — move job to withdrawn, invoice to void
    const [jobUpdate, invoiceUpdate] = await Promise.all([
      admin.from('jobs').update({ status: 'withdrawn' }).eq('id', params.id),
      admin.from('invoices').update({ status: 'void' }).eq('id', invoice.id),
    ])
    if (jobUpdate.error || invoiceUpdate.error) {
      return Response.json({ error: { code: 'DB_ERROR', message: 'Failed to decline' } }, { status: 500 })
    }
    return Response.json({ data: { action: 'declined' } })
  }
}
