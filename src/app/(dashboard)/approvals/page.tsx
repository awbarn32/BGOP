'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string                  // invoice id
  invoice_number: string | null
  status: string
  total_amount: number
  submitted_for_approval_at: string | null
  approved_at: string | null
  owner_decline_reason: string | null
  job: {
    id: string
    status: string
    description: string
    revenue_stream: string | null
    customer: { id: string; full_name: string; phone: string | null }
    vehicle: { make: string; model: string; year: number; color: string | null }
    mechanic?: { full_name: string } | null
  } | null
  line_items: {
    id: string
    line_type: string
    description: string
    quantity: number
    sale_price: number
    is_scope_change: boolean
  }[]
  submitted_by?: { full_name: string } | null
}

type ApprovalTab = 'pending' | 'reviewed'

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', other: 'Other',
}

const STREAM_LABELS: Record<string, string> = {
  service: 'Service & Repair', transport: 'Transport', dlt: 'DLT',
  sourcing: 'Sourcing', commission: 'Commission', ecu: 'ECU Tune',
  track_day: 'Track Day', bike_hotel: 'Bike Hotel',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<ApprovalTab>('pending')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [declineId, setDeclineId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/approvals')
      const json = await res.json()
      setItems(json.data ?? [])
    } catch {
      toast('Failed to load approvals', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  const pending = items.filter((i) => i.status === 'pending_owner_approval')
  const reviewed = items.filter((i) => i.status === 'approved' || i.status === 'owner_declined')

  const displayItems = tab === 'pending' ? pending : reviewed

  async function handleApprove(invoiceId: string) {
    setActing(invoiceId)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/approve-quote`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to approve', 'error'); return }
      toast('Quote approved and sent to customer ✓', 'success')
      await fetchApprovals()
      setExpandedId(null)
    } catch {
      toast('Network error', 'error')
    } finally {
      setActing(null)
    }
  }

  async function handleDecline(invoiceId: string) {
    if (!declineReason.trim()) {
      toast('Please enter a reason for declining', 'error')
      return
    }
    setActing(invoiceId)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/decline-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to decline', 'error'); return }
      toast('Quote declined — PA has been notified', 'success')
      setDeclineId(null)
      setDeclineReason('')
      await fetchApprovals()
    } catch {
      toast('Network error', 'error')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Approvals" />

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => setTab('pending')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pending'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Pending
          {pending.length > 0 && (
            <span className="ml-2 bg-amber-700 text-amber-100 text-xs px-1.5 py-0.5 rounded-full font-semibold">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('reviewed')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'reviewed'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Reviewed
          {reviewed.length > 0 && (
            <span className="ml-2 bg-gray-700 text-gray-400 text-xs px-1.5 py-0.5 rounded-full">
              {reviewed.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-3xl">
              {tab === 'pending' ? '✓' : '📋'}
            </div>
            <p className="text-gray-400 font-medium">
              {tab === 'pending' ? 'No pending approvals' : 'No reviewed items yet'}
            </p>
            {tab === 'pending' && (
              <p className="text-gray-600 text-sm mt-1">Quotes submitted by the PA will appear here</p>
            )}
          </div>
        ) : (
          displayItems.map((item) => {
            const isExpanded = expandedId === item.id
            const isDeclining = declineId === item.id
            const isActing = acting === item.id
            const job = item.job
            const total = item.line_items.reduce((s, li) => s + li.sale_price * li.quantity, 0)

            return (
              <div key={item.id} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
                {/* Card header */}
                <button
                  className="w-full text-left p-4 hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {item.invoice_number && (
                          <span className="text-xs font-mono text-gray-500">{item.invoice_number}</span>
                        )}
                        {item.status === 'pending_owner_approval' && (
                          <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full font-medium">⏳ Awaiting Review</span>
                        )}
                        {item.status === 'approved' && (
                          <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full font-medium">✓ Approved</span>
                        )}
                        {item.status === 'owner_declined' && (
                          <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full font-medium">✕ Declined</span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-white">
                        {job?.customer.full_name ?? '—'}
                      </p>
                      {job && (
                        <p className="text-sm text-gray-400">
                          {job.vehicle.year} {MAKE_LABELS[job.vehicle.make] ?? job.vehicle.make} {job.vehicle.model}
                          {job.vehicle.color && ` · ${job.vehicle.color}`}
                        </p>
                      )}
                      {job?.revenue_stream && (
                        <p className="text-xs text-gray-500 mt-0.5">{STREAM_LABELS[job.revenue_stream] ?? job.revenue_stream}</p>
                      )}
                      {item.submitted_for_approval_at && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Submitted: {fmtDate(item.submitted_for_approval_at)}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-white">฿{total.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.line_items.length} items</p>
                      <span className="text-gray-600 text-sm mt-1 block">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded: line items + actions */}
                {isExpanded && (
                  <div className="border-t border-gray-700 px-4 py-4 space-y-4">
                    {/* Line items */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Line Items</p>
                      <div className="space-y-1.5">
                        {item.line_items.map((li) => (
                          <div key={li.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                li.line_type === 'labour'
                                  ? 'bg-blue-900/40 text-blue-300'
                                  : 'bg-amber-900/40 text-amber-300'
                              }`}>
                                {li.line_type === 'labour' ? 'L' : 'P'}
                              </span>
                              <span className="text-gray-200 truncate">
                                {li.description.includes(' / ') ? li.description.split(' / ')[1] : li.description}
                                {li.quantity !== 1 && ` ×${li.quantity}`}
                              </span>
                              {li.is_scope_change && (
                                <span className="text-xs text-orange-400 flex-shrink-0">SC</span>
                              )}
                            </div>
                            <span className="text-gray-300 flex-shrink-0 ml-3 font-medium">
                              ฿{(li.sale_price * li.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
                          <span className="text-gray-300">Total</span>
                          <span className="text-white">฿{total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Owner decline reason (if already reviewed) */}
                    {item.status === 'owner_declined' && item.owner_decline_reason && (
                      <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
                        <p className="text-xs font-semibold text-red-400 mb-1">Decline reason</p>
                        <p className="text-sm text-red-200">{item.owner_decline_reason}</p>
                        {item.approved_at && (
                          <p className="text-xs text-gray-600 mt-1">Reviewed: {fmtDate(item.approved_at)}</p>
                        )}
                      </div>
                    )}

                    {item.status === 'approved' && item.approved_at && (
                      <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg p-3">
                        <p className="text-xs font-semibold text-emerald-400 mb-1">Approved</p>
                        <p className="text-xs text-gray-500">{fmtDate(item.approved_at)}</p>
                      </div>
                    )}

                    {/* Decline form */}
                    {isDeclining && (
                      <div className="bg-gray-900/60 rounded-lg border border-gray-600 p-3 space-y-2">
                        <p className="text-sm font-medium text-gray-300">Reason for declining (visible to PA)</p>
                        <textarea
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          placeholder="e.g. Labour rate too high — please use standard 800 THB/hr..."
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setDeclineId(null); setDeclineReason('') }}
                            className="flex-1 py-2 rounded-lg border border-gray-600 text-sm text-gray-400 hover:border-gray-500 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDecline(item.id)}
                            disabled={isActing || !declineReason.trim()}
                            className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 text-sm text-white font-medium transition-colors"
                          >
                            {isActing ? 'Declining…' : 'Confirm Decline'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons — pending only */}
                    {item.status === 'pending_owner_approval' && !isDeclining && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setDeclineId(item.id); setDeclineReason('') }}
                          className="flex-1 py-3 rounded-xl border border-red-800/60 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleApprove(item.id)}
                          disabled={isActing}
                          className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold transition-colors"
                        >
                          {isActing ? 'Approving…' : 'Approve & Send ✓'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
