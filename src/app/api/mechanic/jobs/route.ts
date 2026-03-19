import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

// Jobs assigned to the current mechanic (unarchived)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  // Owners/PAs see all; mechanics see only their assigned jobs
  let query = supabase
    .from('jobs')
    .select(`
      id, bucket, status, priority, description, mechanic_notes,
      intake_mileage, completion_mileage, created_at, updated_at,
      customer:customers(id, full_name, phone, line_id, preferred_language),
      vehicle:vehicles(id, make, model, year, license_plate, color, current_mileage),
      scope_changes(id, description, amount_thb, status, created_at)
    `)
    .is('archived_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (role === 'mechanic') {
    query = query.eq('mechanic_id', user.id)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}
