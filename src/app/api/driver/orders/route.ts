import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

const ORDER_SELECT = `
  id, job_id, driver_id, order_type, status, pickup_address, delivery_address,
  scheduled_date, notes, created_at, updated_at,
  job:jobs(
    id, description,
    customer:customers(id, full_name, phone, line_id),
    vehicle:vehicles(id, make, model, year, license_plate)
  )
`

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['driver', 'owner', 'pa'].includes(role)) return forbiddenError()

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')
  const includeCompleted = searchParams.get('include_completed') === 'true'

  let query = supabase
    .from('driver_work_orders')
    .select(ORDER_SELECT)
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!includeCompleted) {
    query = query.not('status', 'in', '("delivered","cancelled")')
  }

  if (role === 'driver') {
    query = query.eq('driver_id', user.id)
  }

  if (jobId) {
    query = query.eq('job_id', jobId)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}

const CreateOrderSchema = z.object({
  job_id: z.string().uuid(),
  order_type: z.enum(['pickup', 'delivery']),
  driver_id: z.string().uuid().nullable().optional(),
  pickup_address: z.string().max(500).nullable().optional(),
  delivery_address: z.string().max(500).nullable().optional(),
  scheduled_date: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { job_id, order_type, driver_id, pickup_address, delivery_address, scheduled_date, notes } = parsed.data

  const insertPayload: Record<string, unknown> = {
    job_id,
    order_type,
    status: driver_id ? 'assigned' : 'pending',
  }
  if (driver_id !== undefined) insertPayload.driver_id = driver_id
  if (pickup_address !== undefined) insertPayload.pickup_address = pickup_address
  if (delivery_address !== undefined) insertPayload.delivery_address = delivery_address
  if (scheduled_date !== undefined) insertPayload.scheduled_date = scheduled_date
  if (notes !== undefined) insertPayload.notes = notes

  const { data, error } = await supabase
    .from('driver_work_orders')
    .insert(insertPayload)
    .select(ORDER_SELECT)
    .single()

  if (error) return serverError(error.message)
  if (!data) return serverError('No data returned')

  // If driver assigned, update job status to driver_assigned
  if (driver_id) {
    await supabase
      .from('jobs')
      .update({ status: 'driver_assigned' })
      .eq('id', job_id)
      .in('status', ['awaiting_drop_off', 'awaiting_pickup'])
  }

  return Response.json({ data }, { status: 201 })
}
