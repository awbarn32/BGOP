import { createClient } from '@/lib/supabase/server'
import {
  UpdateJobSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const DETAIL_SELECT = `
  id, bucket, status, priority, description, mechanic_notes,
  revenue_stream, logistics_type, mechanic_id,
  intake_mileage, completion_mileage,
  owner_notify_threshold_thb,
  created_at, updated_at, completed_at, archived_at,
  customer:customers(id, full_name, phone, line_id, preferred_language, notes),
  vehicle:vehicles(id, make, model, year, license_plate, color, current_mileage),
  mechanic:users(id, full_name),
  line_items:job_line_items(
    id, line_type, description, sku, quantity,
    cost_price, sale_price, is_scope_change, dlt_passthrough
  ),
  status_history:job_status_history(
    id, from_status, to_status, from_bucket, to_bucket, changed_at,
    changed_by, notes
  )
`

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { data, error } = await supabase
    .from('jobs')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error || !data) return notFoundError('Job')
  return Response.json({ data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  // Mechanics can only update their own job notes/mileage fields
  const role = user.app_metadata?.role
  const isMechanic = role === 'mechanic'

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = UpdateJobSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Mechanics may only write mechanic_notes, completion_mileage
  if (isMechanic) {
    const allowed = new Set(['mechanic_notes', 'completion_mileage'])
    const attempted = Object.keys(parsed.data)
    if (attempted.some((k) => !allowed.has(k))) return forbiddenError()
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(parsed.data)
    .eq('id', id)
    .select(DETAIL_SELECT)
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Job')
  return Response.json({ data })
}
