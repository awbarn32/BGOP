import { createClient } from '@/lib/supabase/server'
import {
  CreateVehicleSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { searchParams } = new URL(request.url)
  const customer_id = searchParams.get('customer_id') ?? ''
  const search = searchParams.get('search') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('vehicles')
    .select('*, customer:customers(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (customer_id) {
    query = query.eq('customer_id', customer_id)
  }
  if (search) {
    query = query.or(`make.ilike.%${search}%,model.ilike.%${search}%,license_plate.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) return serverError(error.message)
  return Response.json({ data, total: count ?? 0, page, pageSize })
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

  const parsed = CreateVehicleSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('vehicles')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
