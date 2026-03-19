import type { JobStatus, InvoiceStatus, RevenueStream } from '@/types/domain'

// Status color mapping (Section 4.5 of plan)
const STATUS_COLORS: Record<string, string> = {
  // Blue — New/Waiting
  new: 'bg-blue-100 text-blue-800',
  under_review: 'bg-blue-100 text-blue-800',
  awaiting_customer: 'bg-blue-100 text-blue-800',
  // Amber — Action Needed
  quote_sent: 'bg-amber-100 text-amber-800',
  awaiting_assignment: 'bg-amber-100 text-amber-800',
  awaiting_parts: 'bg-amber-100 text-amber-800',
  awaiting_approval: 'bg-amber-100 text-amber-800',
  awaiting_drop_off: 'bg-amber-100 text-amber-800',
  awaiting_pickup: 'bg-amber-100 text-amber-800',
  // Green — In Progress
  confirmed: 'bg-green-100 text-green-800',
  work_started: 'bg-green-100 text-green-800',
  picked_up: 'bg-green-100 text-green-800',
  in_transit: 'bg-green-100 text-green-800',
  out_for_delivery: 'bg-green-100 text-green-800',
  driver_assigned: 'bg-green-100 text-green-800',
  driver_assigned_delivery: 'bg-green-100 text-green-800',
  // Red — Paused/Blocked
  paused_parts: 'bg-red-100 text-red-800',
  paused_approval: 'bg-red-100 text-red-800',
  // Dark Green — Complete
  work_completed: 'bg-emerald-100 text-emerald-800',
  received_at_shop: 'bg-emerald-100 text-emerald-800',
  returned_to_customer: 'bg-emerald-100 text-emerald-800',
  // Gray — Terminal
  withdrawn: 'bg-gray-100 text-gray-600',
  rejected: 'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-600',
  // Invoice statuses
  quote: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  deposit_paid: 'bg-teal-100 text-teal-800',
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  void: 'bg-gray-100 text-gray-600',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New', under_review: 'Under Review', awaiting_customer: 'Awaiting Customer',
  quote_sent: 'Quote Sent', confirmed: 'Confirmed',
  awaiting_drop_off: 'Awaiting Drop-off', driver_assigned: 'Driver Assigned',
  picked_up: 'Picked Up', in_transit: 'In Transit', received_at_shop: 'Received',
  awaiting_assignment: 'Awaiting Assignment', awaiting_parts: 'Awaiting Parts', awaiting_approval: 'Awaiting Approval',
  work_started: 'Work Started', paused_parts: 'Paused — Parts', paused_approval: 'Paused — Approval', work_completed: 'Work Completed',
  awaiting_pickup: 'Awaiting Pickup', driver_assigned_delivery: 'Driver Assigned', out_for_delivery: 'Out for Delivery', returned_to_customer: 'Returned',
  withdrawn: 'Withdrawn', rejected: 'Rejected', archived: 'Archived',
  quote: 'Quote', approved: 'Approved', deposit_paid: 'Deposit Paid', pending: 'Pending', paid: 'Paid', void: 'Void',
}

interface StatusBadgeProps {
  status: JobStatus | InvoiceStatus | string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colors} ${sizeClass}`}>
      {label}
    </span>
  )
}

// Revenue stream badge
const STREAM_COLORS: Record<RevenueStream, string> = {
  service: 'bg-emerald-900/50 text-emerald-300',
  ecu: 'bg-purple-900/50 text-purple-300',
  sourcing: 'bg-blue-900/50 text-blue-300',
  commission: 'bg-indigo-900/50 text-indigo-300',
  track_day: 'bg-red-900/50 text-red-300',
  transport: 'bg-amber-900/50 text-amber-300',
  dlt: 'bg-gray-700 text-gray-300',
  bike_hotel: 'bg-teal-900/50 text-teal-300',
}

const STREAM_LABELS: Record<RevenueStream, string> = {
  service: 'Service', ecu: 'ECU', sourcing: 'Sourcing', commission: 'Commission',
  track_day: 'Track Day', transport: 'Transport', dlt: 'DLT', bike_hotel: 'Bike Hotel',
}

export function RevenueStreamBadge({ stream }: { stream: RevenueStream }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STREAM_COLORS[stream] ?? 'bg-gray-700 text-gray-300'}`}>
      {STREAM_LABELS[stream] ?? stream}
    </span>
  )
}
