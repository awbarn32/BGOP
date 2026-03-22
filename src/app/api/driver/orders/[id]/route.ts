import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'
import { syncJobFromDriverOrder } from '@/lib/jobs/lifecycle'

type Params = { params: Promise<{ id: string }> }

const DRIVER_STATUS_PROGRESSION: Record<string, string[]> = {
  pending: ['assigned'],
  assigned: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['loaded', 'cancelled'],
  loaded: ['in_transit'],
  in_transit: ['delivered'],
}

const UpdateOrderSchema = z.object({
  status: z.enum(['pending', 'assigned', 'en_route', 'arrived', 'loaded', 'in_transit', 'delivered', 'cancelled']),
  notes: z.string().max(2000).nullable().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['driver', 'owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = UpdateOrderSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Fetch current order
  const { data: current, error: fetchError } = await supabase
    .from('driver_work_orders')
    .select('id, status, driver_id, job_id, order_type')
    .eq('id', id)
    .single()

  if (fetchError || !current) return notFoundError('Work order')

  // Drivers can only update their own orders
  if (role === 'driver' && current.driver_id !== user.id) return forbiddenError()

  // Enforce status progression for drivers
  if (role === 'driver') {
    const allowed = DRIVER_STATUS_PROGRESSION[current.status] ?? []
    if (!allowed.includes(parsed.data.status)) {
      return validationError(`Cannot transition from ${current.status} to ${parsed.data.status}`)
    }
  }

  const updatePayload: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.notes !== undefined) updatePayload.notes = parsed.data.notes

  const { data, error } = await supabase
    .from('driver_work_orders')
    .update(updatePayload)
    .eq('id', id)
    .select(`
      id, order_type, status, pickup_address, delivery_address,
      scheduled_date, notes, created_at, updated_at,
      job:jobs(
        id, description,
        customer:customers(id, full_name, phone, line_id),
        vehicle:vehicles(id, make, model, year, license_plate)
      )
    `)
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Work order')

  try {
    await syncJobFromDriverOrder({
      supabase,
      jobId: current.job_id,
      orderType: current.order_type,
      orderStatus: parsed.data.status,
    })
  } catch {
    // Do not fail the driver update if the job is already ahead of the work-order state.
  }

  return Response.json({ data })
}
