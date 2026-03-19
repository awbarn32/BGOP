/**
 * POST /api/jobs/[id]/transition
 *
 * Validates and applies a job status transition.
 * Fires side effects (LINE notifications) where specified.
 */

import { createClient } from '@/lib/supabase/server'
import { validateTransition } from '@/lib/jobs/transitions'
import {
  unauthorizedError,
  forbiddenError,
  notFoundError,
  validationError,
  serverError,
} from '@/lib/utils/validation'
import { sendLineMessage } from '@/lib/messaging/service'
import * as T from '@/lib/line/templates'
import type { Bucket, JobStatus } from '@/types/domain'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  const isMechanic = role === 'mechanic'

  // Parse body
  let body: unknown
  try { body = await request.json() } catch {
    return validationError('Invalid JSON body')
  }

  const { to_bucket, to_status } = body as { to_bucket?: string; to_status?: string }
  if (!to_bucket || !to_status) {
    return validationError('to_bucket and to_status are required')
  }

  // Fetch current job state
  const { data: job } = await supabase
    .from('jobs')
    .select(`
      id, bucket, status, customer_id, vehicle_id, mechanic_id,
      revenue_stream, logistics_type, description,
      customer:customers(id, full_name, line_id, consent_to_message, preferred_language),
      vehicle:vehicles(id, make, model, year),
      line_items:job_line_items(id)
    `)
    .eq('id', id)
    .single()

  if (!job) return notFoundError('Job')

  // Mechanics can only update their own assigned jobs
  if (isMechanic && job.mechanic_id !== user.id) return forbiddenError()

  // Validate transition
  const result = validateTransition(
    job.bucket as Bucket,
    job.status as JobStatus,
    to_bucket as Bucket,
    to_status as JobStatus
  )

  if (!result.valid) {
    return validationError(result.error)
  }

  // Guard: revenue_stream required before confirming
  if (to_status === 'confirmed' && !job.revenue_stream) {
    return validationError('Revenue stream is required before confirming a job')
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    bucket: result.toBucket,
    status: result.toStatus,
  }

  if (result.toStatus === 'returned_to_customer') {
    updatePayload.archived_at = new Date().toISOString()
    updatePayload.completed_at = updatePayload.completed_at ?? new Date().toISOString()
  }

  if (result.toStatus === 'work_completed') {
    updatePayload.completed_at = new Date().toISOString()
  }

  // Apply update
  const { data: updated, error } = await supabase
    .from('jobs')
    .update(updatePayload)
    .eq('id', id)
    .select('id, bucket, status, priority, mechanic_id, revenue_stream, logistics_type, description, archived_at, completed_at')
    .single()

  if (error || !updated) return serverError(error?.message ?? 'Update failed')

  // ── Fire side effects (non-blocking — don't fail the response) ────────────
  const customer = (job.customer as unknown as {
    id: string; full_name: string; line_id: string | null
    consent_to_message: boolean; preferred_language: string
  } | null)

  const vehicle = (job.vehicle as unknown as { make: string; model: string; year: number } | null)
  const vehicleLabel = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'your bike'
  const customerName = customer?.full_name ?? 'Customer'

  if (customer) {
    const customerId = customer.id

    for (const effect of result.sideEffects) {
      // All LINE sends are fire-and-forget
      switch (effect) {
        case 'line_job_confirmed':
          sendLineMessage({
            customerId,
            jobId: id,
            messageType: 'job_confirmed',
            messages: [T.jobConfirmed(customerName, vehicleLabel)],
          }).catch(console.error)
          break

        case 'line_bike_received':
          sendLineMessage({
            customerId,
            jobId: id,
            messageType: 'bike_received',
            messages: [T.bikeReceivedAtShop(customerName, vehicleLabel)],
          }).catch(console.error)
          break

        case 'line_work_completed': {
          const isPickup = job.logistics_type === 'pickup'
          sendLineMessage({
            customerId,
            jobId: id,
            messageType: 'work_completed',
            messages: [T.workCompleted(customerName, vehicleLabel, isPickup)],
          }).catch(console.error)
          break
        }
      }
    }
  }

  return Response.json({ data: updated })
}
