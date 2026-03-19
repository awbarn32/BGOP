/**
 * Job status transition validation — single source of truth (Plan Section 4.2)
 *
 * Every bucket/status change must pass through validateTransition() before
 * being written to the database. Invalid transitions return a descriptive error
 * rather than silently failing or corrupting state.
 */

import type { Bucket, JobStatus } from '@/types/domain'

// ── Valid transitions map ─────────────────────────────────────────────────────
// Key: `${fromBucket}:${fromStatus}`
// Value: array of allowed `${toBucket}:${toStatus}` targets

const TRANSITIONS: Record<string, string[]> = {
  // NEW REQUESTS
  'new_requests:new': [
    'new_requests:under_review',
    'new_requests:withdrawn',
    'new_requests:rejected',
  ],
  'new_requests:under_review': [
    'new_requests:awaiting_customer',
    'new_requests:quote_sent',
    'new_requests:withdrawn',
    'new_requests:rejected',
  ],
  'new_requests:awaiting_customer': [
    'new_requests:under_review',
    'new_requests:quote_sent',
    'new_requests:withdrawn',
  ],
  'new_requests:quote_sent': [
    'new_requests:confirmed',
    'new_requests:withdrawn',
  ],
  // confirmed auto-moves to intake (PA picks logistics type)
  'new_requests:confirmed': [
    'intake:awaiting_drop_off',
    'intake:driver_assigned',
  ],

  // INTAKE
  'intake:awaiting_drop_off': [
    'intake:received_at_shop',
    'intake:withdrawn',
  ],
  'intake:driver_assigned': [
    'intake:picked_up',
    'intake:withdrawn',
  ],
  'intake:picked_up': [
    'intake:in_transit',
  ],
  'intake:in_transit': [
    'intake:received_at_shop',
  ],
  // received_at_shop auto-moves to available_jobs
  'intake:received_at_shop': [
    'available_jobs:awaiting_assignment',
  ],

  // AVAILABLE JOBS
  'available_jobs:awaiting_assignment': [
    'wip:work_started',        // PA assigns mechanic
    'available_jobs:awaiting_parts',
  ],
  'available_jobs:awaiting_parts': [
    'available_jobs:awaiting_assignment',
  ],
  'available_jobs:awaiting_approval': [
    'available_jobs:awaiting_assignment',
    'available_jobs:awaiting_parts',
  ],

  // WIP
  'wip:work_started': [
    'wip:paused_parts',
    'wip:paused_approval',
    'wip:work_completed',
  ],
  'wip:paused_parts': [
    'wip:work_started',
    'available_jobs:awaiting_parts',
  ],
  'wip:paused_approval': [
    'wip:work_started',
    'available_jobs:awaiting_approval',
  ],
  // work_completed auto-moves to outbound (PA picks delivery type)
  'wip:work_completed': [
    'outbound:awaiting_pickup',
    'outbound:driver_assigned_delivery',
  ],

  // OUTBOUND
  'outbound:awaiting_pickup': [
    'outbound:returned_to_customer',
  ],
  'outbound:driver_assigned_delivery': [
    'outbound:out_for_delivery',
  ],
  'outbound:out_for_delivery': [
    'outbound:returned_to_customer',
  ],
  // returned_to_customer is terminal — job leaves the board (archived)
}

// ── Side effects map ─────────────────────────────────────────────────────────
// Describes what should happen when a transition occurs

export type SideEffect =
  | 'line_job_confirmed'
  | 'line_bike_received'
  | 'line_work_completed'
  | 'line_quote_sent'
  | 'archive_job'
  | 'update_vehicle_service_date'
  | 'create_driver_work_order'

const SIDE_EFFECTS: Record<string, SideEffect[]> = {
  'new_requests:confirmed->intake:awaiting_drop_off': ['line_job_confirmed'],
  'new_requests:confirmed->intake:driver_assigned':   ['line_job_confirmed', 'create_driver_work_order'],
  'intake:received_at_shop->available_jobs:awaiting_assignment': ['line_bike_received'],
  'wip:work_completed->outbound:awaiting_pickup':              ['line_work_completed'],
  'wip:work_completed->outbound:driver_assigned_delivery':     ['line_work_completed', 'create_driver_work_order'],
  'outbound:returned_to_customer->archived':                   ['archive_job', 'update_vehicle_service_date'],
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface TransitionOk {
  valid: true
  toBucket: Bucket
  toStatus: JobStatus
  sideEffects: SideEffect[]
}

export interface TransitionError {
  valid: false
  error: string
}

export type TransitionResult = TransitionOk | TransitionError

// ── Validate ──────────────────────────────────────────────────────────────────

export function validateTransition(
  fromBucket: Bucket,
  fromStatus: JobStatus,
  toBucket: Bucket,
  toStatus: JobStatus
): TransitionResult {
  const key = `${fromBucket}:${fromStatus}`
  const target = `${toBucket}:${toStatus}`

  const allowed = TRANSITIONS[key]
  if (!allowed) {
    return {
      valid: false,
      error: `No transitions defined from ${fromBucket}/${fromStatus}`,
    }
  }

  if (!allowed.includes(target)) {
    return {
      valid: false,
      error: `Cannot move from ${fromStatus} (${fromBucket}) to ${toStatus} (${toBucket}). Allowed: ${allowed.map((t) => t.split(':')[1]).join(', ')}`,
    }
  }

  const effectKey = `${key}->${target}`
  const sideEffects = SIDE_EFFECTS[effectKey] ?? []

  return { valid: true, toBucket, toStatus, sideEffects }
}

// ── Helper: get allowed next statuses for UI display ─────────────────────────

export function getAllowedTransitions(
  fromBucket: Bucket,
  fromStatus: JobStatus
): Array<{ bucket: Bucket; status: JobStatus }> {
  const key = `${fromBucket}:${fromStatus}`
  const allowed = TRANSITIONS[key] ?? []
  return allowed.map((t) => {
    const [bucket, status] = t.split(':')
    return { bucket: bucket as Bucket, status: status as JobStatus }
  })
}

// ── Helper: human-readable status label ──────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  under_review: 'Under Review',
  awaiting_customer: 'Awaiting Customer',
  quote_sent: 'Quote Sent',
  confirmed: 'Confirmed',
  awaiting_drop_off: 'Awaiting Drop-off',
  driver_assigned: 'Driver Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  received_at_shop: 'Received at Shop',
  awaiting_assignment: 'Awaiting Assignment',
  awaiting_parts: 'Awaiting Parts',
  awaiting_approval: 'Awaiting Approval',
  work_started: 'Work Started',
  paused_parts: 'Paused — Parts',
  paused_approval: 'Paused — Approval',
  work_completed: 'Work Completed',
  awaiting_pickup: 'Awaiting Pickup',
  driver_assigned_delivery: 'Driver Assigned',
  out_for_delivery: 'Out for Delivery',
  returned_to_customer: 'Returned to Customer',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
  archived: 'Archived',
}
