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
  const [msgRecipientLang, setMsgRecipientLang] = useState<'en' | 'th'>('th')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [sendingQuoteLink, setSendingQuoteLink] = useState(false)
  const [msgResult, setMsgResult] = useState<{ ok: boolean; text: string } | null>(null)

  // Deposit recording state
  const [recordingDeposit, setRecordingDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<'cash' | 'bank_transfer' | 'promptpay' | 'credit_card' | 'other'>('bank_transfer')
  const [depositSaving, setDepositSaving] = useState(false)

  // Scope change review state (PA sets amounts when approving)
  const [scopeAmounts, setScopeAmounts] = useState<Record<string, string>>({})

  // F5 — Owner approval submit
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Driver work orders state
  interface WorkOrder {
    id: string
    job_id: string
    driver_id: string | null
    order_type: 'pickup' | 'delivery'
    status: string
    pickup_address: string | null
    delivery_address: string | null
    scheduled_date: string | null
    notes: string | null
  }
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [drivers, setDrivers] = useState<{ id: string; full_name: string }[]>([])
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false)
  const [woType, setWoType] = useState<'pickup' | 'delivery'>('pickup')
  const [woDriverId, setWoDriverId] = useState('')
  const [woAddress, setWoAddress] = useState('')
  const [woDate, setWoDate] = useState('')
  const [woNotes, setWoNotes] = useState('')
  const [woSaving, setWoSaving] = useState(false)

  useEffect(() => {
    if (!jobId) { setJob(null); setWorkOrders([]); return }
    setLoading(true)
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((j) => {
        setJob(j.data)
        setStatusEdit(j.data?.status ?? '')
        setMechanicEdit(j.data?.mechanic_id ?? '')
        setNotesEdit(j.data?.mechanic_notes ?? '')
        setNotesChanged(false)
        if (j.data?.logistics_type === 'pickup' || j.data?.bucket === 'outbound' || j.data?.bucket === 'intake') {
          fetch(`/api/driver/orders?job_id=${jobId}&include_completed=true`)
            .then((r) => r.json())
            .then((d) => setWorkOrders(d.data ?? []))
            .catch(() => {/* non-critical */})
        }
      })
      .catch(() => toast('Failed to load job', 'error'))
      .finally(() => setLoading(false))
  }, [jobId, toast])

  useEffect(() => {
    // Load drivers for work order assignment
    fetch('/api/users?role=driver')
      .then((r) => r.json())
      .then((d) => setDrivers(d.data ?? []))
      .catch(() => {/* non-critical */})
  }, [])

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
        body: JSON.stringify({
          text: msgText.trim(),
          sender_language: msgLang,
          recipient_language: msgRecipientLang,
        }),
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

  async function handleCreateWorkOrder() {
    if (!job) return
    setWoSaving(true)
    try {
      const res = await fetch('/api/driver/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          order_type: woType,
          driver_id: woDriverId || null,
          pickup_address: woType === 'pickup' ? (woAddress || null) : null,
          delivery_address: woType === 'delivery' ? (woAddress || null) : null,
          scheduled_date: woDate || null,
          notes: woNotes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to create work order', 'error')
        return
      }
      setWorkOrders((prev) => [...prev, json.data])
      setShowWorkOrderForm(false)
      setWoAddress(''); setWoDate(''); setWoNotes(''); setWoDriverId('')
      toast('Work order created', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setWoSaving(false)
    }
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
    const amountStr = scopeAmounts[scopeId] ?? ''
    const amount_thb = amountStr !== '' ? parseFloat(amountStr) : undefined
    try {
      const res = await fetch(`/api/scope-changes/${scopeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(amount_thb !== undefined ? { amount_thb } : {}) }),
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

  async function handleSendQuoteLink() {
    if (!job || !job.customer.line_id) return
    
    setSendingQuoteLink(true)
    setMsgResult(null)
    
    try {
      // 1. Generate the link
      const quoteUrl = `${window.location.origin}/quote/${job.id}`
      
      // 2. Build the message
      const isThai = msgRecipientLang === 'th'
      const text = isThai
        ? `สวัสดีครับคุณ ${job.customer.full_name}, บัตเลอร์ การาจ ได้เตรียมใบประเมินราคาสำหรับท่านเรียบร้อยแล้ว ท่านสามารถตรวจสอบรายละเอียดและยืนยันผ่านทางลิงก์นี้ได้เลยครับ:\n\n${quoteUrl}`
        : `Hi ${job.customer.full_name}, Butler Garage has prepared your service estimate. You can review the details and authorize the services via this link:\n\n${quoteUrl}`

      // 3. Send via LINE
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: job.customer.id,
          text: text,
          recipient_language: msgRecipientLang,
        }),
      })
      
      const json = await res.json()
      if (!res.ok) {
        setMsgResult({ ok: false, text: json.error?.message ?? 'Failed to send link' })
      } else {
        // 4. Update job status to quote_sent
        await patch({ status: 'quote_sent' as JobStatus })
        setMsgResult({ ok: true, text: 'Digital Quote link sent via LINE ✓' })
      }
    } catch {
      setMsgResult({ ok: false, text: 'Network error' })
    } finally {
      setSendingQuoteLink(false)
    }
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

  // F5 — Submit quote for Owner approval
  async function handleSubmitForApproval() {
    if (!job?.invoice?.[0]) return
    if (!confirm('Submit this quote for Owner approval? The customer will NOT receive it yet.')) return
    setSubmittingApproval(true)
    try {
      const res = await fetch(`/api/invoices/${job.invoice[0].id}/submit-approval`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to submit', 'error'); return }
      const refreshed = await fetch(`/api/jobs/${job.id}`)
      const rJson = await refreshed.json()
      setJob(rJson.data)
      onJobUpdated(rJson.data)
      toast('Submitted for Owner approval ✓', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSubmittingApproval(false)
    }
  }

  async function handleRecordDeposit() {
    if (!job || !job.invoice || !job.invoice[0]) return
    const amt = parseFloat(depositAmount)
    if (isNaN(amt) || amt <= 0) {
      toast('Invalid deposit amount', 'error')
      return
    }
    setDepositSaving(true)
    try {
      const invId = job.invoice[0].id
      const res = await fetch(`/api/invoices/${invId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deposit_amount: amt,
          payment_method: depositMethod,
          status: 'deposit_paid'
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Failed to record deposit', 'error')
        return
      }
      
      // Also confirm the job if it wasn't already confirmed, since money was received
      if (job.status !== 'confirmed') {
        await patch({ status: 'confirmed' as JobStatus })
      } else {
        const refreshed = await fetch(`/api/jobs/${job.id}`)
        const rJson = await refreshed.json()
        setJob(rJson.data)
      }
      
      setRecordingDeposit(false)
      setDepositAmount('')
      toast('Deposit recorded and job confirmed', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setDepositSaving(false)
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
                pending_owner_approval: 'bg-amber-900/50 text-amber-300',
                owner_declined: 'bg-red-900/50 text-red-300',
                approved: 'bg-emerald-900/40 text-emerald-300',
                deposit_paid: 'bg-teal-900/40 text-teal-300',
                pending: 'bg-amber-900/40 text-amber-300',
                paid: 'bg-green-900/40 text-green-300',
                void: 'bg-gray-800 text-gray-500',
              }
              const INVOICE_STATUS_LABELS: Record<string, string> = {
                quote: 'Quote — Draft',
                pending_owner_approval: '⏳ Awaiting Owner Approval',
                owner_declined: '✕ Declined by Owner',
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
                    <div className="space-y-1.5 font-mono">
                      {job.line_items.map((li) => (
                        <div key={li.id} className={`flex items-center justify-between text-xs group ${li.mechanic_completed ? 'opacity-60' : ''}`}>
                          <div className="flex items-center gap-1.5 min-w-0 font-sans">
                            {/* F6 — mechanic completion indicator */}
                            {li.mechanic_completed ? (
                              <span className="text-emerald-400 flex-shrink-0 text-sm" title="Completed by mechanic">✓</span>
                            ) : (
                              <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                li.line_type === 'labour' ? 'bg-blue-900/40 text-blue-300' : 'bg-amber-900/40 text-amber-300'
                              }`}>
                                {li.line_type === 'labour' ? 'L' : 'P'}
                              </span>
                            )}
                            <span className={`truncate ${li.mechanic_completed ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                              {li.description.includes(' / ') ? li.description.split(' / ')[1] : li.description}
                              {li.quantity !== 1 && ` ×${li.quantity}`}
                            </span>
                            {li.is_scope_change && <span className="text-orange-400 flex-shrink-0">SC</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-gray-300">฿{(li.sale_price * li.quantity).toLocaleString()}</span>
                            <button onClick={() => handleDeleteLineItem(li.id)}
                              className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all font-sans" title="Remove item">✕</button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-gray-700 pt-1.5 mt-2 space-y-1">
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-gray-400 font-sans">Total</span>
                          <span className="text-white">฿{lineItemsTotal.toLocaleString()}</span>
                        </div>
                        {inv && inv.deposit_amount && (
                          <>
                            <div className="flex justify-between text-sm text-teal-400">
                              <span className="font-sans">Deposit Paid</span>
                              <span>- ฿{inv.deposit_amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-gray-800">
                              <span className="font-sans">Balance Due</span>
                              <span>฿{Math.max(0, lineItemsTotal - inv.deposit_amount).toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : !addingItem ? (
                    <p className="text-xs text-gray-600 text-center py-3">No items yet — click + Add Item to build the quote</p>
                  ) : null}

                  {/* Record Deposit inline form */}
                  {recordingDeposit && (
                    <div className="mt-4 p-4 bg-teal-900/20 border border-teal-800/40 rounded-xl space-y-3">
                      <p className="text-sm font-medium text-teal-300">Record Deposit Payment</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Amount ฿ (THB)</p>
                          <input
                            type="number"
                            min="1"
                            placeholder="e.g. 5000"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-900 border border-teal-900 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Method</p>
                          <select
                            value={depositMethod}
                            onChange={(e) => setDepositMethod(e.target.value as typeof depositMethod)}
                            className="w-full px-3 py-2 bg-gray-900 border border-teal-900 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                          >
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="promptpay">PromptPay</option>
                            <option value="credit_card">Credit Card</option>
                            <option value="cash">Cash</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setRecordingDeposit(false); setDepositAmount('') }}
                          className="flex-1 py-1.5 rounded-lg border border-teal-900 text-xs text-teal-400 hover:border-teal-700 transition-colors"
                        >Cancel</button>
                        <button
                          onClick={handleRecordDeposit}
                          disabled={depositSaving || !depositAmount}
                          className="flex-1 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-xs text-white font-medium transition-colors"
                        >{depositSaving ? 'Saving…' : 'Save Deposit'}</button>
                      </div>
                    </div>
                  )}

                  {/* F5 — Approval status banners */}
                  {inv?.status === 'pending_owner_approval' && (
                    <div className="mt-3 p-3 bg-amber-900/20 border border-amber-800/40 rounded-xl">
                      <p className="text-sm text-amber-300 font-medium">⏳ Awaiting Owner Approval</p>
                      {inv.submitted_for_approval_at && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Submitted {new Date(inv.submitted_for_approval_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                  {inv?.status === 'owner_declined' && (
                    <div className="mt-3 p-3 bg-red-900/20 border border-red-800/40 rounded-xl">
                      <p className="text-sm text-red-300 font-medium">✕ Declined by Owner</p>
                      {inv.owner_decline_reason && (
                        <p className="text-xs text-red-200 mt-1">{inv.owner_decline_reason}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Revise and resubmit below.</p>
                    </div>
                  )}

                  {/* F7 — Language indicator */}
                  {inv && ['quote', 'owner_declined'].includes(inv.status) && job.line_items.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {job.customer.line_id ? (
                        <span>
                          🌐 Quote will be sent in:{' '}
                          <span className="text-gray-300 font-medium">
                            {job.customer.preferred_language === 'th' ? 'Thai' :
                             job.customer.preferred_language === 'en' ? 'English' : 'Bilingual'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-500">⚠️ No LINE ID — quote can only be sent as PDF</span>
                      )}
                    </div>
                  )}

                  {/* Quote action buttons */}
                  {inv && inv.status !== 'void' && !recordingDeposit && (
                    <div className="mt-3 flex gap-2">
                      {/* F5 — Submit for Owner Approval (replaces direct Send Quote) */}
                      {['quote', 'owner_declined'].includes(inv.status) && job.line_items.length > 0 && (
                        <button
                          onClick={handleSubmitForApproval}
                          disabled={submittingApproval}
                          className="flex-1 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-sm text-white font-semibold transition-colors"
                        >
                          {submittingApproval ? 'Submitting…' : '📤 Submit for Owner Approval'}
                        </button>
                      )}
                      {(job.status === 'quote_sent' || inv.status === 'quote') && !inv.deposit_amount && (
                        <button
                          onClick={() => setRecordingDeposit(true)}
                          disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-sm text-white font-semibold transition-colors"
                        >
                          💰 Record Deposit
                        </button>
                      )}
                      {job.status === 'quote_sent' && (
                        <button
                          onClick={handleConfirmJob}
                          disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm text-white font-semibold transition-colors"
                        >
                          ✓ Confirm Job
                        </button>
                      )}
                      {inv.status === 'approved' && !inv.deposit_amount && (
                        <button
                          onClick={() => setRecordingDeposit(true)}
                          disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-sm text-white font-semibold transition-colors"
                        >
                          💰 Record Deposit
                        </button>
                      )}
                      {(inv.status === 'approved' || inv.status === 'deposit_paid') && job.status === 'confirmed' && (
                        <div className="flex-1 text-center py-2 text-sm text-emerald-400 font-semibold bg-emerald-900/20 rounded-xl">
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

            {/* Driver Work Orders — shown for pickup jobs or intake/outbound buckets */}
            {(job.logistics_type === 'pickup' || job.bucket === 'intake' || job.bucket === 'outbound') && (
              <div className="px-5 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Driver Work Orders</p>
                  {!showWorkOrderForm && (
                    <button
                      onClick={() => {
                        setWoType(job.bucket === 'outbound' ? 'delivery' : 'pickup')
                        setShowWorkOrderForm(true)
                      }}
                      className="text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition-colors"
                    >
                      + New Order
                    </button>
                  )}
                </div>

                {/* Existing work orders */}
                {workOrders.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {workOrders.map((wo) => {
                      const WO_STATUS_STYLE: Record<string, string> = {
                        pending: 'bg-gray-800 text-gray-400',
                        assigned: 'bg-blue-900/50 text-blue-300',
                        en_route: 'bg-amber-900/50 text-amber-300',
                        arrived: 'bg-teal-900/50 text-teal-300',
                        loaded: 'bg-indigo-900/50 text-indigo-300',
                        in_transit: 'bg-purple-900/50 text-purple-300',
                        delivered: 'bg-emerald-900/50 text-emerald-300',
                        cancelled: 'bg-red-900/30 text-red-400',
                      }
                      const WO_STATUS_LABEL: Record<string, string> = {
                        pending: 'Pending', assigned: 'Assigned', en_route: 'En Route',
                        arrived: 'Arrived', loaded: 'Loaded', in_transit: 'In Transit',
                        delivered: 'Delivered', cancelled: 'Cancelled',
                      }
                      const driverName = wo.driver_id
                        ? (drivers.find((d) => d.id === wo.driver_id)?.full_name ?? 'Driver')
                        : 'Unassigned'
                      const address = wo.order_type === 'pickup' ? wo.pickup_address : wo.delivery_address
                      return (
                        <div key={wo.id} className="rounded-xl p-3 bg-gray-800/50 border border-gray-700 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${wo.order_type === 'pickup' ? 'bg-amber-900/50 text-amber-300' : 'bg-teal-900/50 text-teal-300'}`}>
                              {wo.order_type === 'pickup' ? '🏍️ Pickup' : '🚚 Delivery'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-medium ${WO_STATUS_STYLE[wo.status] ?? 'bg-gray-800 text-gray-400'}`}>
                              {WO_STATUS_LABEL[wo.status] ?? wo.status}
                            </span>
                          </div>
                          <p className="text-gray-400">{driverName}</p>
                          {address && <p className="text-gray-500">{address}</p>}
                          {wo.scheduled_date && (
                            <p className="text-gray-500">
                              {new Date(wo.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {workOrders.length === 0 && !showWorkOrderForm && (
                  <p className="text-xs text-gray-600 italic">No work orders yet.</p>
                )}

                {/* Create work order form */}
                {showWorkOrderForm && (
                  <div className="p-3 bg-gray-800/60 rounded-xl border border-gray-700 space-y-2">
                    <div className="flex gap-2">
                      {(['pickup', 'delivery'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setWoType(t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            woType === t ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {t === 'pickup' ? '🏍️ Pickup' : '🚚 Delivery'}
                        </button>
                      ))}
                    </div>
                    <select
                      value={woDriverId}
                      onChange={(e) => setWoDriverId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">— No driver assigned yet —</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder={woType === 'pickup' ? 'Pickup address' : 'Delivery address'}
                      value={woAddress}
                      onChange={(e) => setWoAddress(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="date"
                      value={woDate}
                      onChange={(e) => setWoDate(e.target.value)}
                      className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <textarea
                      placeholder="Notes (optional)"
                      value={woNotes}
                      onChange={(e) => setWoNotes(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setShowWorkOrderForm(false); setWoAddress(''); setWoDate(''); setWoNotes(''); setWoDriverId('') }}
                        className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateWorkOrder}
                        disabled={woSaving}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
                      >
                        {woSaving ? 'Creating…' : 'Create Order'}
                      </button>
                    </div>
                  </div>
                )}
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
                        {sc.status !== 'flagged' && (
                          <span className="font-mono text-sm text-white flex-shrink-0">
                            ฿{sc.amount_thb.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {sc.mechanic_notes && (
                        <p className="text-xs text-gray-500 mb-2 italic">{sc.mechanic_notes}</p>
                      )}
                      {sc.status === 'flagged' && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-400 flex-shrink-0">Amount (฿)</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={scopeAmounts[sc.id] ?? ''}
                            onChange={(e) => setScopeAmounts((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                            className="flex-1 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>
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
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">Customer receives:</span>
                <button
                  onClick={() => setMsgRecipientLang('en')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    msgRecipientLang === 'en' ? 'bg-green-700/80 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setMsgRecipientLang('th')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    msgRecipientLang === 'th' ? 'bg-green-700/80 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  ภาษาไทย (Thai)
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
                AI will translate your message to the selected receiving language.
              </p>
              {msgResult && (
                <p className={`text-xs mb-2 ${msgResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {msgResult.text}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!msgText.trim() || sendingMsg || sendingQuoteLink}
                  loading={sendingMsg}
                  onClick={handleSendMessage}
                >
                  {sendingMsg ? 'Translating & Sending…' : 'Send via LINE'}
                </Button>
                {job.customer.line_id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={sendingMsg || sendingQuoteLink}
                    loading={sendingQuoteLink}
                    onClick={handleSendQuoteLink}
                  >
                    {sendingQuoteLink ? 'Sending Link…' : '📄 Send Quote Link'}
                  </Button>
                )}
              </div>
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
