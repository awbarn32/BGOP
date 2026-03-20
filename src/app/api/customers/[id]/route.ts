import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  UpdateCustomerSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  // Fetch customer with their vehicles
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customer) return notFoundError('Customer')

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', id)
    .order('year', { ascending: false })

  return Response.json({ data: { ...customer, vehicles: vehicles ?? [] } })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
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

  const parsed = UpdateCustomerSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('customers')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Customer')

  // Retroactively link orphaned incoming LINE messages if a valid LINE ID was just added
  if (parsed.data.line_id && parsed.data.line_id.startsWith('U')) {
    const adminSupabase = createAdminClient()
    const unknownPrefix = `[Unknown LINE user: ${parsed.data.line_id}]%`
    await adminSupabase
      .from('message_log')
      .update({ customer_id: data.id })
      .is('customer_id', null)
      .like('content', unknownPrefix)
  }

  return Response.json({ data })
}
