import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CreateCustomerSchema,
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
  const search = searchParams.get('search') ?? ''
  const dormant = searchParams.get('dormant') ?? ''
  const acquisition_source = searchParams.get('acquisition_source') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50', 10)
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('full_name')
    .range(offset, offset + pageSize - 1)

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,line_id.ilike.%${search}%`
    )
  }
  if (dormant === 'true') {
    query = query.eq('dormant', true)
  } else if (dormant === 'false') {
    query = query.eq('dormant', false)
  }
  if (acquisition_source) {
    query = query.eq('acquisition_source', acquisition_source)
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

  const parsed = CreateCustomerSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('customers')
    .insert({ ...parsed.data, dormant: false })
    .select()
    .single()

  if (error) return serverError(error.message)

  // Retroactively link orphaned incoming LINE messages if a valid LINE ID was provided
  if (parsed.data.line_id && parsed.data.line_id.startsWith('U')) {
    const adminSupabase = createAdminClient()
    const unknownPrefix = `[Unknown LINE user: ${parsed.data.line_id}]%`
    await adminSupabase
      .from('message_log')
      .update({ customer_id: data.id })
      .is('customer_id', null)
      .like('content', unknownPrefix)
  }

  return Response.json({ data }, { status: 201 })
}
