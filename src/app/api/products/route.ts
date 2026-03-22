import { createClient, getSessionUser } from '@/lib/supabase/server'
import {
  CreateProductSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return unauthorizedError()

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''
  const active = searchParams.get('active') ?? 'true'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('category', { ascending: true })
    .order('name', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (active !== 'all') {
    query = query.eq('active', active === 'true')
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error, count } = await query
  if (error) return serverError(error.message)

  return Response.json({ data, total: count ?? 0, page, pageSize })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateProductSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('products')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
