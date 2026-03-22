/**
 * POST /api/jobs/[id]/transition
 *
 * Validates and applies a job lifecycle transition without triggering
 * messaging side effects. Lifecycle UIs should use this route rather than
 * writing bucket/status directly through generic PATCH.
 */

import { createClient } from '@/lib/supabase/server'
import {
  unauthorizedError,
  forbiddenError,
  validationError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'
import { transitionJob } from '@/lib/jobs/lifecycle'
import type { Bucket, JobStatus } from '@/types/domain'

type Params = { params: Promise<{ id: string }> }

const DETAIL_SELECT = `
  id, bucket, status, priority, description, mechanic_notes,
  revenue_stream, logistics_type, mechanic_id,
  intake_mileage, completion_mileage, intake_photos,
  owner_notify_threshold_thb,
  created_at, updated_at, completed_at, archived_at,
  customer:customers(id, full_name, phone, line_id, email, preferred_language, notes),
  vehicle:vehicles(id, make, model, year, license_plate, color, last_service_date, current_mileage),
  mechanic:users(id, full_name),
  line_items:job_line_items(
    id, line_type, description, sku, quantity,
    cost_price, sale_price, is_scope_change, dlt_passthrough
  ),
  status_history:job_status_history(
    id, from_status, to_status, from_bucket, to_bucket, changed_at,
    changed_by, notes
  ),
  scope_changes(
    id, description, amount_thb, status, mechanic_notes, created_at
  ),
  invoice:invoices(id, invoice_number, status, total_amount, deposit_amount, paid_amount)
`

function withLegacyCompatibleDetail<T extends Record<string, unknown>>(job: T) {
  return {
    pickup_address: null,
    ...job,
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (!['owner', 'pa', 'mechanic', 'driver'].includes(role)) return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const { to_bucket, to_status } = body as { to_bucket?: string; to_status?: string }
  if (!to_bucket || !to_status) {
    return validationError('to_bucket and to_status are required')
  }

  const { data: currentJob, error: fetchError } = await supabase
    .from('jobs')
    .select('id, mechanic_id')
    .eq('id', id)
    .single()

  if (fetchError || !currentJob) return notFoundError('Job')

  if (role === 'mechanic' && currentJob.mechanic_id !== user.id) return forbiddenError()

  try {
    await transitionJob({
      supabase,
      jobId: id,
      toBucket: to_bucket as Bucket,
      toStatus: to_status as JobStatus,
    })
  } catch (error) {
    return validationError(error instanceof Error ? error.message : 'Invalid transition')
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Job')

  return Response.json({ data: withLegacyCompatibleDetail(data) })
}
