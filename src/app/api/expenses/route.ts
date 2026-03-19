import { createClient } from '@/lib/supabase/server'
import {
  CreateExpenseSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (category) query = query.eq('category', category)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

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

  const parsed = CreateExpenseSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('expenses')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
