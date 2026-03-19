'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { StatusBadge, RevenueStreamBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { BUCKET_STATUSES } from '@/types/kanban'
import type { Bucket, JobStatus, User } from '@/types/domain'
import type { JobCard } from '@/types/kanban'

// Full job detail shape (from GET /api/jobs/[id])
interface JobDetail extends JobCard {
  mechanic_notes: string | null
  intake_mileage: number | null
  completion_mileage: number | null
  completed_at: string | null
  archived_at: string | null
  customer: JobCard['customer'] & {
    preferred_language: string
    notes: string | null
  }
  vehicle: JobCard['vehicle'] & {
    color: string | null
    current_mileage: number | null
  }
  line_items: {
    id: string
    line_type: string
    description: string
    sku: string | null
    quantity: number
    sale_price: number
    is_scope_change: boolean
  }[]
  status_history: {
    id: string
    from_status: string | null
    to_status: string
    changed_at: string
  }[]
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New', under_review: 'Under Review', awaiting_customer: 'Awaiting Customer',
  quote_sent: 'Quote Sent', confirmed: 'Confirmed',
  awaiting_drop_off: 'Awaiting Drop-off', driver_assigned: 'Driver Assigned',
  picked_up: 'Picked Up', in_transit: 'In Transit', received_at_shop: 'Received',
  awaiting_assignment: 'Awaiting Assignment', awaiting_parts: 'Awaiting Parts',
  awaiting_approval: 'Awaiting Approval',
  work_started: 'Work Started', paused_parts: 'Paused — Parts',
  paused_approval: 'Paused — Approval', work_completed: 'Work Completed',
  awaiting_pickup: 'Awaiting Pickup', driver_assigned_delivery: 'Driver Assigned',
  out_for_delivery: 'Out for Delivery', returned_to_customer: 'Returned',
  withdrawn: 'Withdrawn', rejected: 'Rejected', archived: 'Archived',
}

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', benelli: 'Benelli',
  cfmoto: 'CFMOTO', other: 'Other',
}

interface JobDrawerProps {
  jobId: string | null
  onClose: () => void
  onJobUpdated: (job: JobCard) => void
  mechanics: Pick<User, 'id' | 'full_name'>[]
}

export function JobDrawer({ jobId, onClose, onJobUpdated, mechanics }: JobDrawerProps) {
  const { toast } = useToast()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [_statusEdit, setStatusEdit] = useState<JobStatus | ''>('')
  const [mechanicEdit, setMechanicEdit] = useState<string>('')
  const [notesEdit, setNotesEdit] = useState('')
  const [notesChanged, setNotesChanged] = useState(false)

  useEffect(() => {
    if (!jobId) { setJob(null); return }
    setLoading(true)
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((j) => {
        setJob(j.data)
        setStatusEdit(j.data?.status ?? '')
        setMechanicEdit(j.data?.mechanic_id ?? '')
        setNotesEdit(j.data?.mechanic_notes ?? '')
        setNotesChanged(false)
      })
      .catch(() => toast('Failed to load job', 'error'))
      .finally(() => setLoading(false))
  }, [jobId, toast])

  async function patch(payload: Record<string, unknown>) {
    if (!job) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Update failed', 'error')
        return
      }
      setJob(json.data)
      onJobUpdated(json.data)
      toast('Updated', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: JobStatus) {
    setStatusEdit(newStatus)
    await patch({ status: newStatus })
  }

  async function handleMechanicChange(mechanicId: string) {
    setMechanicEdit(mechanicId)
    await patch({ mechanic_id: mechanicId || null })
  }

  async function handleSaveNotes() {
    await patch({ mechanic_notes: notesEdit.trim() || null })
    setNotesChanged(false)
  }

  async function handleMarkComplete() {
    await patch({
      bucket: 'outbound' as Bucket,
      status: 'awaiting_pickup' as JobStatus,
    })
  }

  async function handleArchive() {
    if (!confirm('Archive this job? It will leave the board.')) return
    await patch({
      archived_at: new Date().toISOString(),
      status: 'archived' as JobStatus,
    })
    onClose()
  }

  const isOpen = !!jobId

  const lineItemsTotal = job?.line_items.reduce((sum, li) => sum + li.sale_price * li.quantity, 0) ?? 0

  const validStatuses = job ? BUCKET_STATUSES[job.bucket] : []

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700
        shadow-2xl flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Job Detail</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !job ? null : (
          <div className="flex-1 overflow-y-auto">
            {/* Customer + vehicle */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/customers/${job.customer.id}`} className="text-lg font-semibold text-white hover:text-indigo-300 transition-colors">
                    {job.customer.full_name}
                  </Link>
                  <Link href={`/vehicles/${job.vehicle.id}`} className="block text-sm text-gray-400 hover:text-indigo-300 transition-colors mt-0.5">
                    {job.vehicle.year} {MAKE_LABELS[job.vehicle.make] ?? job.vehicle.make} {job.vehicle.model}
                    {job.vehicle.license_plate && ` · ${job.vehicle.license_plate}`}
                    {job.vehicle.color && ` · ${job.vehicle.color}`}
                  </Link>
                  <div className="flex gap-2 mt-1 text-xs text-gray-500">
                    {job.customer.phone && <span>{job.customer.phone}</span>}
                    {job.customer.line_id && <span>LINE: {job.customer.line_id}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {job.revenue_stream && <RevenueStreamBadge stream={job.revenue_stream} />}
                  {job.logistics_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      job.logistics_type === 'pickup'
                        ? 'bg-amber-900/50 text-amber-300'
                        : 'bg-blue-900/50 text-blue-300'
                    }`}>
                      {job.logistics_type === 'pickup' ? 'Pickup' : 'Drop-off'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status controls */}
            <div className="px-5 py-4 border-b border-gray-800 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {validStatuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={saving}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        job.status === s
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {STATUS_LABELS[s] ?? s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mechanic assignment */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Mechanic</p>
                <select
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={mechanicEdit}
                  onChange={(e) => handleMechanicChange(e.target.value)}
                  disabled={saving}
                >
                  <option value="">— Unassigned —</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="px-5 py-4 border-b border-gray-800">
              <p className="text-xs text-gray-500 mb-1.5">Description</p>
              <div className="text-sm text-gray-200 whitespace-pre-wrap">
                {job.description.includes(' / ')
                  ? job.description.split(' / ').join('\n')
                  : job.description}
              </div>
            </div>

            {/* Mechanic notes */}
            <div className="px-5 py-4 border-b border-gray-800">
              <p className="text-xs text-gray-500 mb-1.5">Mechanic Notes</p>
              <textarea
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[80px]"
                value={notesEdit}
                onChange={(e) => { setNotesEdit(e.target.value); setNotesChanged(true) }}
                placeholder="Notes for the mechanic..."
              />
              {notesChanged && (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" loading={saving} onClick={handleSaveNotes}>
                    Save Notes
                  </Button>
                </div>
              )}
            </div>

            {/* Mileage */}
            {(job.intake_mileage != null || job.vehicle.current_mileage != null) && (
              <div className="px-5 py-4 border-b border-gray-800">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Intake Mileage</p>
                    <p className="text-gray-200">
                      {job.intake_mileage != null ? `${job.intake_mileage.toLocaleString()} km` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Current Mileage</p>
                    <p className="text-gray-200">
                      {job.vehicle.current_mileage != null ? `${job.vehicle.current_mileage.toLocaleString()} km` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Line items */}
            {job.line_items.length > 0 && (
              <div className="px-5 py-4 border-b border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Line Items</p>
                <div className="space-y-1.5">
                  {job.line_items.map((li) => (
                    <div key={li.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                          li.line_type === 'labour'
                            ? 'bg-blue-900/40 text-blue-300'
                            : 'bg-amber-900/40 text-amber-300'
                        }`}>
                          {li.line_type === 'labour' ? 'L' : 'P'}
                        </span>
                        <span className="text-gray-300 truncate">
                          {li.description.includes(' / ') ? li.description.split(' / ')[1] : li.description}
                          {li.quantity !== 1 && ` ×${li.quantity}`}
                        </span>
                        {li.is_scope_change && (
                          <span className="text-orange-400 flex-shrink-0">SC</span>
                        )}
                      </div>
                      <span className="text-gray-300 font-mono flex-shrink-0 ml-2">
                        ฿{(li.sale_price * li.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-700 pt-1.5 flex justify-between text-sm font-semibold">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white font-mono">฿{lineItemsTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Status history */}
            {job.status_history.length > 0 && (
              <div className="px-5 py-4 border-b border-gray-800">
                <p className="text-xs text-gray-500 mb-2">History</p>
                <div className="space-y-1">
                  {[...job.status_history]
                    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                    .slice(0, 8)
                    .map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex-shrink-0 text-gray-600">
                          {new Date(h.changed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {' '}
                          {new Date(h.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {h.from_status && (
                          <>
                            <StatusBadge status={h.from_status as JobStatus} size="sm" />
                            <span>→</span>
                          </>
                        )}
                        <StatusBadge status={h.to_status as JobStatus} size="sm" />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 space-y-2">
              {job.bucket === 'wip' && job.status === 'work_completed' && (
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  loading={saving}
                  onClick={handleMarkComplete}
                >
                  Move to Outbound →
                </Button>
              )}

              <div className="flex justify-between">
                <span className="text-xs text-gray-600">
                  Created {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {!job.archived_at && (
                  <button
                    onClick={handleArchive}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                  >
                    Archive job
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
