import type { Bucket, JobStatus } from '@/types/domain'
import { validateTransition } from '@/lib/jobs/transitions'
import type { Database } from '@/types/domain'

const JOB_STATE_SELECT = `
  id,
  bucket,
  status,
  logistics_type,
  vehicle_id,
  intake_mileage,
  completion_mileage,
  completed_at,
  archived_at
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any }

interface JobState {
  id: string
  bucket: Bucket
  status: JobStatus
  logistics_type: 'drop_off' | 'pickup' | null
  vehicle_id: string
  intake_mileage: number | null
  completion_mileage: number | null
  completed_at: string | null
  archived_at: string | null
}

interface TransitionJobOptions {
  supabase: SupabaseLike
  jobId: string
  toBucket: Bucket
  toStatus: JobStatus
  extraUpdates?: Database['public']['Tables']['jobs']['Update']
}

async function fetchJobState(supabase: SupabaseLike, jobId: string): Promise<JobState> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_STATE_SELECT)
    .eq('id', jobId)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Job not found')
  }

  return data as unknown as JobState
}

async function updateVehicleServiceHistory(supabase: SupabaseLike, job: JobState) {
  const lastServiceMileage = job.completion_mileage ?? job.intake_mileage
  const updatePayload: Database['public']['Tables']['vehicles']['Update'] = {
    last_service_date: new Date().toISOString().slice(0, 10),
  }

  if (lastServiceMileage != null) {
    updatePayload.last_service_mileage = lastServiceMileage
  }

  await supabase
    .from('vehicles')
    .update(updatePayload)
    .eq('id', job.vehicle_id)
}

async function syncReturnArtifacts(supabase: SupabaseLike, job: JobState) {
  await updateVehicleServiceHistory(supabase, job)

  await supabase
    .from('invoices')
    .update({ status: 'pending' } as Database['public']['Tables']['invoices']['Update'])
    .eq('job_id', job.id)
    .in('status', ['approved', 'deposit_paid'])
}

export async function transitionJob(options: TransitionJobOptions): Promise<JobState> {
  const { supabase, jobId, toBucket, toStatus, extraUpdates } = options

  const current = await fetchJobState(supabase, jobId)

  if (
    current.bucket === toBucket &&
    current.status === toStatus &&
    (!extraUpdates || Object.keys(extraUpdates).length === 0)
  ) {
    return current
  }

  const result = validateTransition(current.bucket, current.status, toBucket, toStatus)
  if (!result.valid) {
    throw new Error(result.error)
  }

  const now = new Date().toISOString()
  const updatePayload: Database['public']['Tables']['jobs']['Update'] = {
    bucket: result.toBucket,
    status: result.toStatus,
    ...extraUpdates,
  }

  if (result.toStatus === 'work_completed' && !current.completed_at) {
    updatePayload.completed_at = now
  }

  if (result.toStatus === 'returned_to_customer') {
    updatePayload.archived_at = now
    updatePayload.completed_at = current.completed_at ?? now
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updatePayload)
    .eq('id', jobId)
    .select(JOB_STATE_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update job')
  }

  const updated = data as unknown as JobState

  if (updated.status === 'confirmed') {
    const intakeTarget =
      updated.logistics_type === 'pickup'
        ? { bucket: 'intake' as Bucket, status: 'driver_assigned' as JobStatus }
        : { bucket: 'intake' as Bucket, status: 'awaiting_drop_off' as JobStatus }

    return transitionJob({
      supabase,
      jobId,
      toBucket: intakeTarget.bucket,
      toStatus: intakeTarget.status,
    })
  }

  if (updated.status === 'received_at_shop') {
    return transitionJob({
      supabase,
      jobId,
      toBucket: 'available_jobs',
      toStatus: 'awaiting_assignment',
    })
  }

  if (updated.status === 'work_completed') {
    const outboundTarget =
      updated.logistics_type === 'pickup'
        ? { bucket: 'outbound' as Bucket, status: 'driver_assigned_delivery' as JobStatus }
        : { bucket: 'outbound' as Bucket, status: 'awaiting_pickup' as JobStatus }

    return transitionJob({
      supabase,
      jobId,
      toBucket: outboundTarget.bucket,
      toStatus: outboundTarget.status,
    })
  }

  if (updated.status === 'returned_to_customer') {
    await syncReturnArtifacts(supabase, updated)
  }

  return updated
}

interface AssignMechanicOptions {
  supabase: SupabaseLike
  jobId: string
  mechanicId: string | null
}

export async function assignMechanic(options: AssignMechanicOptions): Promise<JobState> {
  const { supabase, jobId, mechanicId } = options
  const current = await fetchJobState(supabase, jobId)

  if (mechanicId && current.bucket === 'available_jobs' && current.status === 'awaiting_assignment') {
    return transitionJob({
      supabase,
      jobId,
      toBucket: 'wip',
      toStatus: 'work_started',
      extraUpdates: { mechanic_id: mechanicId },
    })
  }

  if (!mechanicId && current.bucket === 'wip' && current.status === 'paused_parts') {
    return transitionJob({
      supabase,
      jobId,
      toBucket: 'available_jobs',
      toStatus: 'awaiting_parts',
      extraUpdates: { mechanic_id: null },
    })
  }

  if (!mechanicId && current.bucket === 'wip' && current.status === 'paused_approval') {
    return transitionJob({
      supabase,
      jobId,
      toBucket: 'available_jobs',
      toStatus: 'awaiting_approval',
      extraUpdates: { mechanic_id: null },
    })
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({ mechanic_id: mechanicId } as Database['public']['Tables']['jobs']['Update'])
    .eq('id', jobId)
    .select(JOB_STATE_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update mechanic')
  }

  return data as unknown as JobState
}

interface SyncDriverJobOptions {
  supabase: SupabaseLike
  jobId: string
  orderType: 'pickup' | 'delivery'
  orderStatus: string
}

export async function syncJobFromDriverOrder(options: SyncDriverJobOptions): Promise<JobState | null> {
  const { supabase, jobId, orderType, orderStatus } = options
  const current = await fetchJobState(supabase, jobId)

  if (orderType === 'pickup') {
    if (orderStatus === 'loaded' && current.bucket === 'intake' && current.status === 'driver_assigned') {
      return transitionJob({ supabase, jobId, toBucket: 'intake', toStatus: 'picked_up' })
    }

    if (orderStatus === 'in_transit' && current.bucket === 'intake' && current.status === 'picked_up') {
      return transitionJob({ supabase, jobId, toBucket: 'intake', toStatus: 'in_transit' })
    }

    if (orderStatus === 'delivered' && current.bucket === 'intake' && current.status === 'in_transit') {
      return transitionJob({ supabase, jobId, toBucket: 'intake', toStatus: 'received_at_shop' })
    }
  }

  if (orderType === 'delivery') {
    if (
      (orderStatus === 'loaded' || orderStatus === 'in_transit') &&
      current.bucket === 'outbound' &&
      current.status === 'driver_assigned_delivery'
    ) {
      return transitionJob({ supabase, jobId, toBucket: 'outbound', toStatus: 'out_for_delivery' })
    }

    if (
      orderStatus === 'delivered' &&
      current.bucket === 'outbound' &&
      (current.status === 'driver_assigned_delivery' || current.status === 'out_for_delivery')
    ) {
      return transitionJob({ supabase, jobId, toBucket: 'outbound', toStatus: 'returned_to_customer' })
    }
  }

  return null
}
