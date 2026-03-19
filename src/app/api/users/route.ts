import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, serverError } from '@/lib/utils/validation'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role, preferred_language')
    .order('full_name')

  if (error) return serverError(error.message)
  return Response.json({ data })
}
