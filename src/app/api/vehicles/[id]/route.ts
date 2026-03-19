import { createClient } from '@/lib/supabase/server'
import {
  UpdateVehicleSchema,
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

  const { data, error } = await supabase
    .from('vehicles')
    .select('*, customer:customers(id, full_name)')
    .eq('id', id)
    .single()

  if (error || !data) return notFoundError('Vehicle')
  return Response.json({ data })
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

  const parsed = UpdateVehicleSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('vehicles')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Vehicle')
  return Response.json({ data })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner') return forbiddenError()

  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) return serverError(error.message)
  return Response.json({ success: true })
}
