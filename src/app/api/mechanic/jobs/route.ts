import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

// Jobs for the mechanic view — no pricing or contact data
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  const { searchParams } = new URL(req.url)
  const completed = searchParams.get('completed') === 'true'

  let query = supabase
    .from('jobs')
    .select(`
      id, bucket, status, priority, description, mechanic_notes,
      intake_mileage, completion_mileage, created_at, updated_at,
      customer:customers(id, full_name),
      vehicle:vehicles(id, make, model, year, license_plate, color, current_mileage),
      scope_changes(id, description, status, created_at),
      line_items:job_line_items(id, description, quantity, line_type)
    `)
    .is('archived_at', null)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (completed) {
    // Recently completed jobs — last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query
      .in('status', ['work_completed', 'awaiting_pickup', 'out_for_delivery', 'returned_to_customer'])
      .gte('updated_at', since)
  } else {
    query = query.eq('bucket', 'wip')
  }

  if (role === 'mechanic') {
    query = query.eq('mechanic_id', user.id)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}
