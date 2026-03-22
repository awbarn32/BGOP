import { createClient, getSessionUser } from '@/lib/supabase/server'
import { unauthorizedError, serverError } from '@/lib/utils/validation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return unauthorizedError()

  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')

  let query = supabase
    .from('users')
    .select('id, full_name, role, preferred_language')
    .order('full_name')

  if (roleFilter) {
    query = query.eq('role', roleFilter)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}
