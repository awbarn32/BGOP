import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

// Work orders for the current driver
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['driver', 'owner', 'pa'].includes(role)) return forbiddenError()

  let query = supabase
    .from('driver_work_orders')
    .select(`
      id, order_type, status, pickup_address, delivery_address,
      scheduled_date, notes, created_at, updated_at,
      job:jobs(
        id, description,
        customer:customers(id, full_name, phone, line_id),
        vehicle:vehicles(id, make, model, year, license_plate)
      )
    `)
    .not('status', 'in', '("delivered","cancelled")')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (role === 'driver') {
    query = query.eq('driver_id', user.id)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}
