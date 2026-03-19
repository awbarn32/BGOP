/**
 * DELETE /api/jobs/[id]/line-items/[itemId]
 * PATCH  /api/jobs/[id]/line-items/[itemId]  — update quantity or price
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

type Params = { params: Promise<{ id: string; itemId: string }> }

const PatchSchema = z.object({
  quantity: z.number().positive().optional(),
  sale_price: z.number().nonnegative().optional(),
  cost_price: z.number().nonnegative().nullable().optional(),
  description: z.string().min(1).max(255).optional(),
})

export async function DELETE(_request: Request, { params }: Params) {
  const { id, itemId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role === 'mechanic' || role === 'driver') return forbiddenError()

  const { data: item } = await supabase
    .from('job_line_items')
    .select('id, job_id')
    .eq('id', itemId)
    .eq('job_id', id)
    .single()

  if (!item) return notFoundError('Line item')

  const { error } = await supabase
    .from('job_line_items')
    .delete()
    .eq('id', itemId)

  if (error) return serverError(error.message)

  // Sync linked invoice total after deletion (ignore errors — non-blocking)
  const { data: remaining } = await supabase
    .from('job_line_items')
    .select('sale_price, quantity')
    .eq('job_id', id)
  const newTotal = (remaining ?? []).reduce((s, li) => s + li.sale_price * li.quantity, 0)
  await supabase
    .from('invoices')
    .update({ total_amount: newTotal })
    .eq('job_id', id)
    .not('status', 'in', '("paid","void")')

  return new Response(null, { status: 204 })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id, itemId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role === 'mechanic' || role === 'driver') return forbiddenError()

  let body: unknown
  try { body = await request.json() } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data: updated, error } = await supabase
    .from('job_line_items')
    .update(parsed.data)
    .eq('id', itemId)
    .eq('job_id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!updated) return notFoundError('Line item')
  return Response.json({ data: updated })
}
