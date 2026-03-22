import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

const CreateSchema = z.object({
  job_id: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  product_id: z.string().uuid().nullable().optional(),
})

// GET /api/parts-requests?job_id=xxx
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  const jobId = req.nextUrl.searchParams.get('job_id')

  let query = supabase
    .from('parts_requests')
    .select('id, job_id, description, quantity, status, pa_notes, created_at, product:products(id, name, sku)')
    .order('created_at', { ascending: false })

  if (jobId) query = query.eq('job_id', jobId)
  if (role === 'mechanic') query = query.eq('mechanic_id', user.id)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}

// POST /api/parts-requests
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try { body = await req.json() } catch { return validationError('Invalid JSON') }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { job_id, description, quantity, product_id } = parsed.data

  const { data, error } = await supabase
    .from('parts_requests')
    .insert({
      job_id,
      mechanic_id: user.id,
      description,
      quantity,
      product_id: product_id ?? null,
      status: 'requested',
    })
    .select('id, job_id, description, quantity, status, pa_notes, created_at')
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
