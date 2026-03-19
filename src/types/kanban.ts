import type { Bucket, JobStatus, RevenueStream, LogisticsType } from './domain'

// Shape returned by GET /api/jobs (Kanban card data)
export interface JobCard {
  id: string
  bucket: Bucket
  status: JobStatus
  priority: number
  description: string
  revenue_stream: RevenueStream | null
  logistics_type: LogisticsType | null
  mechanic_id: string | null
  owner_notify_threshold_thb: number
  created_at: string
  updated_at: string
  customer: {
    id: string
    full_name: string
    phone: string | null
    line_id: string | null
  }
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    license_plate: string | null
  }
  mechanic: {
    id: string
    full_name: string
  } | null
}

// Valid statuses per bucket
export const BUCKET_STATUSES: Record<Bucket, JobStatus[]> = {
  new_requests: ['new', 'under_review', 'awaiting_customer', 'quote_sent', 'confirmed'],
  intake: ['awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit', 'received_at_shop'],
  available_jobs: ['awaiting_assignment', 'awaiting_parts', 'awaiting_approval'],
  wip: ['work_started', 'paused_parts', 'paused_approval', 'work_completed'],
  outbound: ['awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer'],
}

// Default status when a card is moved into a bucket
export const BUCKET_DEFAULT_STATUS: Record<Bucket, JobStatus> = {
  new_requests: 'new',
  intake: 'awaiting_drop_off',
  available_jobs: 'awaiting_assignment',
  wip: 'work_started',
  outbound: 'awaiting_pickup',
}

// Column display config
export const BUCKET_CONFIG: Record<Bucket, { label: string; color: string; textColor: string }> = {
  new_requests: { label: 'New Requests', color: 'border-t-blue-500', textColor: 'text-blue-400' },
  intake: { label: 'Intake', color: 'border-t-amber-500', textColor: 'text-amber-400' },
  available_jobs: { label: 'Available Jobs', color: 'border-t-purple-500', textColor: 'text-purple-400' },
  wip: { label: 'WIP', color: 'border-t-emerald-500', textColor: 'text-emerald-400' },
  outbound: { label: 'Outbound', color: 'border-t-teal-500', textColor: 'text-teal-400' },
}

export const BUCKET_ORDER: Bucket[] = [
  'new_requests', 'intake', 'available_jobs', 'wip', 'outbound',
]
