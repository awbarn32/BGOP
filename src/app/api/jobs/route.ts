import { createClient } from '@/lib/supabase/server'
import {
  CreateJobSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

// Kanban-optimised SELECT — only the fields cards need
const CARD_SELECT = `
  id, bucket, status, priority, description,
  revenue_stream, logistics_type, mechanic_id,
  owner_notify_threshold_thb, created_at, updated_at,
  customer:customers(id, full_name, phone, line_id),
  vehicle:vehicles(id, make, model, year, license_plate),
  mechanic:users(id, full_name)
`

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get('bucket') ?? ''
  const archived = searchParams.get('archived') === 'true'

  let query = supabase
    .from('jobs')
    .select(CARD_SELECT)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (archived) {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
  }

  if (bucket) {
    query = query.eq('bucket', bucket)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateJobSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('jobs')
    .insert(parsed.data)
    .select(CARD_SELECT)
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
