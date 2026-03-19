'use client'

import { useState, useEffect, useRef } from 'react'
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
  scope_changes: {
    id: string
    description: string
    amount_thb: number
    status: string
    mechanic_notes: string | null
    created_at: string
  }[]
  invoice: {
    id: string
    invoice_number: string
    status: string
    total_amount: number
    deposit_amount: number | null
    paid_amount: number | null
  }[] | null
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

  // Quote builder state
  const [addingItem, setAddingItem] = useState(false)
  const [itemType, setItemType] = useState<'labour' | 'part'>('labour')
  const [itemDesc, setItemDesc] = useState('')
  const [itemQty, setItemQty] = useState('1')
  const [itemSalePrice, setItemSalePrice] = useState('')
  const [itemCostPrice, setItemCostPrice] = useState('')
  const [itemSaving, setItemSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<{ id: string; name: string; sale_price: number; cost_price: number | null; sku: string }[]>([])
  const [productSearching, setProductSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // LINE messaging panel
  const [msgText, setMsgText] = useState('')
  const [msgLang, setMsgLang] = useState<'en' | 'th'>('en')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgResult, setMsgResult] = useState<{ ok: boolean; text: string } | null>(null)

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

  async function handleSendMessage() {
    if (!job || !msgText.trim()) return
    setSendingMsg(true)
    setMsgResult(null)
    try {
      const res = await fetch(`/api/jobs/${job.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText.trim(), sender_language: msgLang }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsgResult({ ok: false, text: json.error?.message ?? 'Failed to send' })
      } else if (json.skipped) {
        setMsgResult({ ok: false, text: json.reason })
      } else {
        setMsgResult({ ok: true, text: json.demo ? 'Demo mode — message logged but not sent' : 'Message sent via LINE ✓' })
        setMsgText('')
      }
    } catch {
      setMsgResult({ ok: false, text: 'Network error' })
    } finally {
      setSendingMsg(false)
    }
  }

  async function handleArchive() {
    if (!confirm('Archive this job? It will leave the board.')) return
    await patch({
      archived_at: new Date().toISOString(),
      status: 'archived' as JobStatus,
    })
    onClose()
  }

  function handleProductSearchChange(val: string) {
    setProductSearch(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!val.trim()) { setProductResults([]); return }
    setProductSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(val)}&active=true&pageSize=8`)
        const json = await res.json()
        setProductResults(json.data ?? [])
      } catch { setProductResults([]) }
      finally { setProductSearching(false) }
    }, 300)
  }

  function selectProduct(p: typeof productResults[0]) {
    setItemDesc(p.name.includes(' / ') ? p.name.split(' / ')[1] : p.name)
    setItemSalePrice(String(p.sale_price))
    setItemCostPrice(p.cost_price != null ? String(p.cost_price) : '')
    setProductSearch('')
    setProductResults([])
  }

  async function handleAddLineItem() {
    if (!job || !itemDesc.trim() || !itemSalePrice) return
    setItemSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_type: itemType,
          description: itemDesc.trim(),
          quantity: parseFloat(itemQty) || 1,
          sale_price: parseFloat(itemSalePrice),
          cost_price: itemCostPrice ? parseFloat(itemCostPrice) : null,
          cost_estimated: !itemCostPrice,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to add item', 'error'); return }
      // Refresh job to get updated line_items
      const refreshed = await fetch(`/api/jobs/${job.id}`)
      const rJson = await refreshed.json()
      setJob(rJson.data)
      // Reset form
      setItemDesc(''); setItemQty('1'); setItemSalePrice(''); setItemCostPrice('')
      setAddingItem(false)
      toast('Item added', 'success')
    } catch { toast('Network error', 'error') }
    finally { setItemSaving(false) }
  }

  async function handleDeleteLineItem(itemId: string) {
    if (!job) return
    try {
      await fetch(`/api/jobs/${job.id}/line-items/${itemId}`, { method: 'DELETE' })
      setJob((prev) => prev ? {
        ...prev,
        line_items: prev.line_items.filter((li) => li.id !== itemId)
      } : prev)
    } catch { toast('Failed to delete item', 'error') }
  }

  async function handleScopeAction(scopeId: string, action: 'approve' | 'decline') {
    const label = action === 'approve' ? 'Approve' : 'Decline'
    if (!confirm(`${label} this scope change?`)) return
    try {
      const res = await fetch(`/api/scope-changes/${scopeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed', 'error'); return }
      // Refresh job
      const refreshed = await fetch(`/api/jobs/${job!.id}`)
      const rJson = await refreshed.json()
      setJob(rJson.data)
      onJobUpdated(rJson.data)
      toast(action === 'approve' ? 'Scope change approved — line item added' : 'Scope change declined', action === 'approve' ? 'success' : 'error')
    } catch { toast('Network error', 'error') }
  }

  async function handleSendQuote() {
    if (!job) return
    if (!confirm('Mark quote as sent and update job status to Quote Sent?')) return
    await patch({ status: 'quote_sent' as JobStatus })
  }

  async function handleConfirmJob() {
    if (!job) return
    const inv = job.invoice?.[0]
    if (!confirm('Confirm the job? This marks the customer as approved and locks the quote.')) return
    // Update job status
    await patch({ status: 'confirmed' as JobStatus })
    // Update invoice status to approved
    if (inv) {
      await fetch(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      // Refresh job to get updated invoice
      const refreshed = await fetch(`/api/jobs/${job.id}`)
      const rJson = await refreshed.json()
      setJob(rJson.data)
    }
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
                      {job.logistics_type === 'pickup' ? 'Pickup (we collect)' : 'Drop-off (customer delivers)'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quote / Invoice */}
            {(() => {
              const inv = job.invoice?.[0] ?? null
              const INVOICE_STATUS_STYLES: Record<string, string> = {
                quote: 'bg-blue-900/40 text-blue-300',
                approved: 'bg-emerald-900/40 text-emerald-300',
                deposit_paid: 'bg-teal-900/40 text-teal-300',
                pending: 'bg-amber-900/40 text-amber-300',
                paid: 'bg-green-900/40 text-green-300',
                void: 'bg-gray-800 text-gray-500',
              }
              const INVOICE_STATUS_LABELS: Record<string, string> = {
                quote: 'Quote — Draft',
                approved: 'Confirmed',
                deposit_paid: 'Deposit Paid',
                pending: 'Awaiting Payment',
                paid: 'Paid ✓',
                void: 'Void',
              }
              return (
                <div className="px-5 py-4 border-b border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-300">Quote / Invoice</p>
                      {inv && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_STYLES[inv.status] ?? 'bg-gray-800 text-gray-400'}`}>
                          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                      )}
                      {inv?.invoice_number && (
                        <span className="text-xs text-gray-600 font-mono">{inv.invoice_number}</span>
                      )}
                    </div>
                    {!addingItem && (
                      <button
                        onClick={() => setAddingItem(true)}
                        className="text-xs px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                      >
                        + Add Item
                      </button>
                    )}
                  </div>

                  {/* Add item form */}
                  {addingItem && (
                    <div className="mb-3 p-3 bg-gray-800/60 rounded-xl border border-gray-700 space-y-2">
                      {/* Product search */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search product catalog…"
                          value={productSearch}
                          onChange={(e) => handleProductSearchChange(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        {productSearching && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">…</span>
                        )}
                        {productResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                            {productResults.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => selectProduct(p)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs transition-colors"
                              >
                                <span className="text-white">{p.name.includes(' / ') ? p.name.split(' / ')[1] : p.name}</span>
                                <span className="text-gray-500 ml-2">฿{p.sale_price.toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Type + description */}
                      <div className="flex gap-2">
                        <select
                          value={itemType}
                          onChange={(e) => setItemType(e.target.value as 'labour' | 'part')}
                          className="px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none"
                        >
                          <option value="labour">Labour</option>
                          <option value="part">Part</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Description"
                          value={itemDesc}
                          onChange={(e) => setItemDesc(e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      {/* Qty + prices */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-gray-600 mb-0.5">Qty</p>
                          <input type="number" min="0.01" step="0.01" value={itemQty} onChange={(e) => setItemQty(e.target.value)}
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-0.5">Sale ฿</p>
                          <input type="number" min="0" placeholder="0" value={itemSalePrice} onChange={(e) => setItemSalePrice(e.target.value)}
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-0.5">Cost ฿</p>
                          <input type="number" min="0" placeholder="0" value={itemCostPrice} onChange={(e) => setItemCostPrice(e.target.value)}
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setAddingItem(false); setItemDesc(''); setItemSalePrice(''); setItemCostPrice(''); setProductSearch(''); setProductResults([]) }}
                          className="flex-1 py-1.5 rounded-lg border border-gray-600 text-xs text-gray-400 hover:border-gray-500 transition-colors"
                        >Cancel</button>
                        <button
                          onClick={handleAddLineItem}
                          disabled={itemSaving || !itemDesc.trim() || !itemSalePrice}
                          className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs text-white font-medium transition-colors"
                        >{itemSaving ? 'Adding…' : 'Add'}</button>
                      </div>
                    </div>
                  )}

                  {/* Line items list */}
                  {job.line_items.length > 0 ? (
                    <div className="space-y-1.5">
                      {job.line_items.map((li) => (
                        <div key={li.id} className="flex items-center justify-between text-xs group">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                              li.line_type === 'labour' ? 'bg-blue-900/40 text-blue-300' : 'bg-amber-900/40 text-amber-300'
                            }`}>
                              {li.line_type === 'labour' ? 'L' : 'P'}
                            </span>
                            <span className="text-gray-300 truncate">
                              {li.description.includes(' / ') ? li.description.split(' / ')[1] : li.description}
                              {li.quantity !== 1 && ` ×${li.quantity}`}
                            </span>
                            {li.is_scope_change && <span className="text-orange-400 flex-shrink-0">SC</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-gray-300 font-mono">฿{(li.sale_price * li.quantity).toLocaleString()}</span>
                            <button onClick={() => handleDeleteLineItem(li.id)}
                              className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Remove item">✕</button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-gray-700 pt-1.5 flex justify-between text-sm font-semibold">
                        <span className="text-gray-400">Total</span>
                        <span className="text-white font-mono">฿{lineItemsTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : !addingItem ? (
                    <p className="text-xs text-gray-600 text-center py-3">No items yet — click + Add Item to build the quote</p>
                  ) : null}

                  {/* Quote action buttons */}
                  {inv && inv.status !== 'void' && (
                    <div className="mt-3 flex gap-2">
                      {job.status !== 'quote_sent' && job.status !== 'confirmed' && inv.status === 'quote' && job.line_items.length > 0 && (
                        <button
                          onClick={handleSendQuote}
                          disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-sm text-white font-semibold transition-colors"
                        >
                          📤 Send Quote
                        </button>
                      )}
                      {job.status === 'quote_sent' && (
                        <button
                          onClick={handleConfirmJob}
                          disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white font-semibold transition-colors"
                        >
                          ✓ Confirm Job
                        </button>
                      )}
                      {inv.status === 'approved' && (
                        <div className="flex-1 text-center py-2 text-sm text-emerald-400 font-semibold">
                          ✓ Job Confirmed
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

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

            {/* Scope changes — PA review */}
            {job.scope_changes && job.scope_changes.length > 0 && (
              <div className="px-5 py-4 border-b border-gray-800">
                <p className="text-xs text-gray-500 mb-2">
                  Scope Changes
                  {job.scope_changes.some((s) => s.status === 'flagged') && (
                    <span className="ml-2 text-orange-400 text-xs font-medium">● Needs Review</span>
                  )}
                </p>
                <div className="space-y-3">
                  {job.scope_changes.map((sc) => (
                    <div key={sc.id} className={`rounded-xl p-3 border ${
                      sc.status === 'flagged' ? 'bg-orange-950/30 border-orange-800/50' :
                      sc.status === 'approved' ? 'bg-emerald-950/30 border-emerald-800/50' :
                      'bg-red-950/30 border-red-800/50'
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm text-gray-200 flex-1">{sc.description}</p>
                        <span className="font-mono text-sm text-white flex-shrink-0">
                          ฿{sc.amount_thb.toLocaleString()}
                        </span>
                      </div>
                      {sc.mechanic_notes && (
                        <p className="text-xs text-gray-500 mb-2 italic">{sc.mechanic_notes}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          sc.status === 'approved' ? 'bg-emerald-900 text-emerald-300' :
                          sc.status === 'declined' ? 'bg-red-900 text-red-300' :
                          'bg-orange-900 text-orange-300'
                        }`}>
                          {sc.status === 'approved' ? '✓ Approved' :
                           sc.status === 'declined' ? '✕ Declined' : '⏳ Flagged — Pending Review'}
                        </span>
                        {sc.status === 'flagged' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleScopeAction(sc.id, 'decline')}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-red-900/50 hover:bg-red-900 text-red-300 transition-colors"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleScopeAction(sc.id, 'approve')}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LINE Message Panel */}
            <div className="px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs text-gray-500">Send Message via LINE</p>
                {job.customer.line_id ? (
                  <span className="text-xs px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded">
                    LINE connected
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded">
                    No LINE ID
                  </span>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setMsgLang('en')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    msgLang === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  I&apos;m typing in English
                </button>
                <button
                  onClick={() => setMsgLang('th')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    msgLang === 'th' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  พิมพ์เป็นภาษาไทย
                </button>
              </div>
              <textarea
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[72px]"
                value={msgText}
                onChange={(e) => { setMsgText(e.target.value); setMsgResult(null) }}
                placeholder={msgLang === 'th' ? 'พิมพ์ข้อความ... (AI จะแปลเป็นภาษาอังกฤษอัตโนมัติ)' : 'Type your message... (AI will auto-translate to Thai)'}
                disabled={sendingMsg}
              />
              <p className="text-xs text-gray-600 mt-1 mb-2">
                Claude AI will translate your message — the customer receives both languages.
              </p>
              {msgResult && (
                <p className={`text-xs mb-2 ${msgResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {msgResult.text}
                </p>
              )}
              <Button
                size="sm"
                disabled={!msgText.trim() || sendingMsg}
                loading={sendingMsg}
                onClick={handleSendMessage}
              >
                {sendingMsg ? 'Translating & Sending…' : 'Send via LINE'}
              </Button>
            </div>

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
