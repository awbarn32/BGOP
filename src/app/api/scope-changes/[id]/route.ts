/**
 * PATCH /api/scope-changes/[id]
 *
 * PA approves or declines a scope change flagged by a mechanic.
 *
 * Body: { action: 'approve' | 'decline', pa_notes?: string }
 *
 * On approve: adds a job_line_item for the scope change and
 * updates the invoice total if one exists.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  unauthorizedError,
  forbiddenError,
  notFoundError,
  validationError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  action: z.enum(['approve', 'decline']),
  pa_notes: z.string().max(2000).nullable().optional(),
  amount_thb: z.number().nonnegative().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  let body: unknown
  try { body = await request.json() } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { action, pa_notes, amount_thb } = parsed.data

  // Fetch the scope change
  const { data: sc } = await supabase
    .from('scope_changes')
    .select('id, job_id, description, amount_thb, status')
    .eq('id', id)
    .single()

  if (!sc) return notFoundError('Scope change')

  if (sc.status !== 'flagged' && sc.status !== 'pending') {
    return validationError(`Scope change is already ${sc.status}`)
  }

  const newStatus = action === 'approve' ? 'approved' : 'declined'

  // PA can set/override the amount when approving
  const finalAmount = amount_thb ?? sc.amount_thb

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    pa_notes: pa_notes ?? null,
  }
  if (amount_thb !== undefined) {
    updatePayload.amount_thb = amount_thb
  }

  const { data: updated, error } = await supabase
    .from('scope_changes')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)

  // On approval: add a line item to the job for the scope change amount
  if (action === 'approve') {
    await supabase.from('job_line_items').insert({
      job_id: sc.job_id,
      line_type: 'labour',
      description: sc.description,
      quantity: 1,
      sale_price: finalAmount,
      cost_price: null,
      cost_estimated: true,
      is_scope_change: true,
    })

    // Update invoice total if a non-paid invoice exists for this job
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, total_amount')
      .eq('job_id', sc.job_id)
      .not('status', 'in', '("paid","void")')
      .single()

    if (invoice) {
      await supabase
        .from('invoices')
        .update({ total_amount: invoice.total_amount + finalAmount })
        .eq('id', invoice.id)
    }
  }

  return Response.json({ data: updated })
}
