/**
 * GET  /api/jobs/[id]/line-items  — list line items for a job
 * POST /api/jobs/[id]/line-items  — add a line item (cost_price required for parts)
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

const LineItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  line_type: z.enum(['labour', 'part']),
  description: z.string().min(1).max(255),
  sku: z.string().max(50).nullable().optional(),
  quantity: z.number().positive(),
  cost_price: z.number().nonnegative().nullable().optional(),
  sale_price: z.number().nonnegative(),
  dlt_passthrough: z.boolean().default(false),
  is_scope_change: z.boolean().default(false),
  cost_estimated: z.boolean().default(false),
})

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { data, error } = await supabase
    .from('job_line_items')
    .select('*')
    .eq('job_id', id)
    .order('created_at')

  if (error) return serverError(error.message)
  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role === 'mechanic' || role === 'driver') return forbiddenError()

  // Verify job exists
  const { data: job } = await supabase
    .from('jobs')
    .select('id, revenue_stream')
    .eq('id', id)
    .single()
  if (!job) return notFoundError('Job')

  let body: unknown
  try { body = await request.json() } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = LineItemSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const item = parsed.data

  // Enforce cost_price required for new parts (not legacy imports)
  if (item.line_type === 'part' && !item.is_scope_change) {
    if (item.cost_price == null && !item.cost_estimated) {
      return validationError(
        'cost_price is required for parts. Set cost_estimated=true for legacy items without cost data.'
      )
    }
  }

  // If product_id given, check if product has cost_price (mark estimated if not)
  let costEstimated = item.cost_estimated
  if (item.product_id && item.line_type === 'part') {
    const { data: product } = await supabase
      .from('products')
      .select('cost_price')
      .eq('id', item.product_id)
      .single()
    if (product && product.cost_price == null) {
      costEstimated = true
    }
  }

  const { data: created, error } = await supabase
    .from('job_line_items')
    .insert({
      job_id: id,
      product_id: item.product_id ?? null,
      line_type: item.line_type,
      description: item.description,
      sku: item.sku ?? null,
      quantity: item.quantity,
      cost_price: item.cost_price ?? null,
      sale_price: item.sale_price,
      dlt_passthrough: item.dlt_passthrough,
      is_scope_change: item.is_scope_change,
      cost_estimated: costEstimated,
    })
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data: created }, { status: 201 })
}
