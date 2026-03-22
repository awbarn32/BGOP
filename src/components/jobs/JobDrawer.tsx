'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { StatusBadge, RevenueStreamBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { BUCKET_STATUSES } from '@/types/kanban'
import type { Bucket, JobStatus, RevenueStream, User } from '@/types/domain'
import type { JobCard } from '@/types/kanban'

// Full job detail shape (from GET /api/jobs/[id])
interface JobDetail extends JobCard {
  mechanic_notes: string | null
  pickup_address: string | null
  intake_mileage: number | null
  completion_mileage: number | null
  completed_at: string | null
  archived_at: string | null
  customer: JobCard['customer'] & {
    email?: string | null
    preferred_language: string
    notes: string | null
  }
  vehicle: JobCard['vehicle'] & {
    color: string | null
    last_service_date?: string | null
    current_mileage: number | null
  }
  line_items: {
    id: string
    line_type: string
    description: string
    sku: string | null
    quantity: number
    cost_price?: number | null
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

const BUCKET_LABELS: Record<Bucket, string> = {
  new_requests: 'New requests',
  intake: 'Intake',
  available_jobs: 'Available jobs',
  wip: 'WIP',
  outbound: 'Outbound',
}

const REVENUE_STREAM_OPTIONS: Array<{ value: RevenueStream; label: string }> = [
  { value: 'service', label: 'Service & Repair' },
  { value: 'ecu', label: 'ECU / Tuning' },
  { value: 'transport', label: 'Transport' },
  { value: 'dlt', label: 'DLT / Documents' },
  { value: 'track_day', label: 'Track Day / Rental' },
  { value: 'sourcing', label: 'Bike Sourcing' },
  { value: 'bike_hotel', label: 'Bike Hotel' },
  { value: 'commission', label: 'Commission' },
]

const EMPTY_MECHANICS: Pick<User, 'id' | 'full_name'>[] = []

interface JobDrawerProps {
  jobId: string | null
  onClose: () => void
  onJobUpdated?: (job: JobCard) => void
  mechanics?: Pick<User, 'id' | 'full_name'>[]
}

export function JobDrawer({
  jobId,
  onClose,
  onJobUpdated,
  mechanics = EMPTY_MECHANICS,
}: JobDrawerProps) {
  const { toast } = useToast()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mechanicOptions, setMechanicOptions] = useState(mechanics)

  // Editable fields
  const [_statusEdit, setStatusEdit] = useState<JobStatus | ''>('')
  const [mechanicEdit, setMechanicEdit] = useState<string>('')
  const [notesEdit, setNotesEdit] = useState('')
  const [_notesChanged, setNotesChanged] = useState(false)

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
  const [_productSearching, setProductSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // LINE messaging panel
  const [msgText, setMsgText] = useState('')
  const [msgLang, _setMsgLang] = useState<'en' | 'th'>('en')
  const [msgRecipientLang, _setMsgRecipientLang] = useState<'en' | 'th'>('th')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [sendingQuoteLink, setSendingQuoteLink] = useState(false)
  const [msgResult, setMsgResult] = useState<{ ok: boolean; text: string } | null>(null)

  // Deposit recording state
  const [recordingDeposit, setRecordingDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<'cash' | 'bank_transfer' | 'promptpay' | 'credit_card' | 'other'>('bank_transfer')
  const [depositSaving, setDepositSaving] = useState(false)

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
  const [_showWorkOrderForm, _setShowWorkOrderForm] = useState(false)
  const [woType, _setWoType] = useState<'pickup' | 'delivery'>('pickup')
  const [woDriverId, setWoDriverId] = useState('')
  const [woAddress, setWoAddress] = useState('')
  const [woDate, setWoDate] = useState('')
  const [woNotes, setWoNotes] = useState('')
  const [_woSaving, setWoSaving] = useState(false)

  useEffect(() => {
    setMechanicOptions(mechanics)
  }, [mechanics])

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
    if (mechanics.length > 0) return

    fetch('/api/users', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data) {
          setMechanicOptions(
            j.data.filter((u: User) => u.role === 'mechanic' || u.role === 'pa' || u.role === 'owner')
          )
        }
      })
      .catch(() => {})
  }, [mechanics])

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
      onJobUpdated?.(json.data)
      toast('Updated', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function transition(toBucket: Bucket, toStatus: JobStatus) {
    if (!job) return false
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_bucket: toBucket, to_status: toStatus }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? 'Transition failed', 'error')
        return false
      }
      setJob(json.data)
      onJobUpdated?.(json.data)
      toast('Updated', 'success')
      return true
    } catch {
      toast('Network error', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: JobStatus) {
    setStatusEdit(newStatus)
    if (!job) return
    await transition(job.bucket, newStatus)
  }

  async function handleMechanicChange(mechanicId: string) {
    setMechanicEdit(mechanicId)
    await patch({ mechanic_id: mechanicId || null })
  }

  async function handleRevenueStreamChange(stream: string) {
    if (!stream) return
    await patch({ revenue_stream: stream })
  }

  async function _handleSaveNotes() {
    await patch({ mechanic_notes: notesEdit.trim() || null })
    setNotesChanged(false)
  }

  async function _handleMarkComplete() {
    if (!job) return
    await transition(
      'outbound',
      job.logistics_type === 'pickup' ? 'driver_assigned_delivery' : 'awaiting_pickup'
    )
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  async function _handleArchive() {
    if (!confirm('Archive this job? It will leave the board.')) return
    await patch({
      archived_at: new Date().toISOString(),
    })
    onClose()
  }

  async function _handleCreateWorkOrder() {
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
      _setShowWorkOrderForm(false)
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

  async function _handleDeleteLineItem(itemId: string) {
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
      onJobUpdated?.(rJson.data)
      toast(action === 'approve' ? 'Scope change approved — line item added' : 'Scope change declined', action === 'approve' ? 'success' : 'error')
    } catch { toast('Network error', 'error') }
  }

  async function _handleSendQuote() {
    if (!job) return
    if (!confirm('Mark quote as sent and update job status to Quote Sent?')) return
    await transition(job.bucket, 'quote_sent')
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
      const quoteNote = msgText.trim()
      const text = isThai
        ? `สวัสดีครับคุณ ${job.customer.full_name}, บัตเลอร์ การาจ ได้เตรียมใบประเมินราคาสำหรับท่านเรียบร้อยแล้ว${quoteNote ? `\n\n${quoteNote}` : ''}\n\nท่านสามารถตรวจสอบรายละเอียดและยืนยันผ่านทางลิงก์นี้ได้เลยครับ:\n\n${quoteUrl}`
        : `Hi ${job.customer.full_name}, Butler Garage has prepared your service estimate.${quoteNote ? `\n\n${quoteNote}` : ''}\n\nYou can review the details and authorize the services via this link:\n\n${quoteUrl}`

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
        const ok = await transition(job.bucket, 'quote_sent')
        if (ok) {
          setMsgResult({ ok: true, text: 'Digital Quote link sent via LINE ✓' })
          setMsgText('')
        }
      }
    } catch {
      setMsgResult({ ok: false, text: 'Network error' })
    } finally {
      setSendingQuoteLink(false)
    }
  }

  async function _handleConfirmJob() {
    if (!job) return
    const inv = job.invoice?.[0]
    if (!confirm('Confirm the job? This marks the customer as approved and locks the quote.')) return
    let invoiceOk = true
    if (inv) {
      const invoiceRes = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      invoiceOk = invoiceRes.ok
    }
    if (!invoiceOk) {
      toast('Failed to approve invoice', 'error')
      return
    }
    await transition(job.bucket, 'confirmed')
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
        await transition(job.bucket, 'confirmed')
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

  const lineItemsTotal = job?.line_items.reduce((sum, li) => sum + li.sale_price * li.quantity, 0) ?? 0

  const validStatuses = job ? BUCKET_STATUSES[job.bucket] : []
  const currentInvoice = job?.invoice?.[0] ?? null
  const customerInitials = job?.customer.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') ?? 'BG'
  const canReject = job?.bucket === 'new_requests' && (job.status === 'new' || job.status === 'under_review')
  const timelineEntries = job ? [
    {
      id: 'created',
      label: 'Job created',
      changedAt: job.created_at,
      detail: `${BUCKET_LABELS[job.bucket]} • ${STATUS_LABELS[job.status] ?? job.status}`,
    },
    ...[...job.status_history]
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
      .map((entry) => ({
        id: entry.id,
        label: entry.from_status
          ? `${STATUS_LABELS[entry.from_status] ?? entry.from_status} → ${STATUS_LABELS[entry.to_status] ?? entry.to_status}`
          : `${STATUS_LABELS[entry.to_status] ?? entry.to_status}`,
        changedAt: entry.changed_at,
        detail: BUCKET_LABELS[job.bucket],
      })),
  ] : []

  return (
      <div className="flex-1 overflow-y-auto bg-gray-950 text-white">
        {loading ? (
          <div className="flex h-full items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : !job ? (
          <div className="mx-auto flex max-w-3xl items-center justify-center px-6 py-24">
            <div className="rounded-2xl border border-gray-700 bg-gray-900 px-8 py-10 text-center shadow-sm">
              <p className="text-lg font-semibold text-white">Job detail unavailable</p>
              <p className="mt-2 text-sm text-gray-400">The selected job could not be loaded.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                Back to board
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gray-800 bg-gray-900 px-6 py-5 shadow-sm">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
                >
                  ← Jobs
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-mono text-lg font-semibold text-white">
                      {currentInvoice?.invoice_number ?? `JOB-${job.id.slice(0, 8).toUpperCase()}`}
                    </p>
                    <StatusBadge status={job.status} />
                    <span className="text-sm text-gray-500">
                      {job.customer.preferred_language === 'th' ? 'Thai speaker' : 'English speaker'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    {job.logistics_type === 'pickup' ? 'Pickup job' : 'Drop-off job'} • Created{' '}
                    {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canReject && (
                  <button
                    type="button"
                    onClick={() => { void transition(job.bucket, 'rejected') }}
                    disabled={saving}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => scrollToSection('job-contact')}
                  className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800"
                >
                  Contact customer
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('job-quote')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                >
                  Build quote
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/15 text-sm font-semibold text-indigo-300">
                      {customerInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold text-white">{job.customer.full_name}</h2>
                          <p className="text-sm text-gray-500">
                            {job.customer.preferred_language === 'th' ? 'Thai speaker' : 'English speaker'}
                          </p>
                        </div>
                        {job.revenue_stream && <RevenueStreamBadge stream={job.revenue_stream} />}
                      </div>

                      <dl className="mt-5 divide-y divide-gray-800 text-sm">
                        <div className="flex items-center justify-between gap-4 py-2">
                          <dt className="text-gray-500">Phone</dt>
                          <dd className="text-right font-medium text-gray-200">{job.customer.phone ?? '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-2">
                          <dt className="text-gray-500">LINE</dt>
                          <dd className="text-right font-medium text-gray-200">{job.customer.line_id ?? '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-2">
                          <dt className="text-gray-500">Email</dt>
                          <dd className="text-right font-medium text-gray-200">{job.customer.email ?? '—'}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-2">
                          <dt className="text-gray-500">Customer record</dt>
                          <dd className="text-right">
                            <Link href={`/customers/${job.customer.id}`} className="font-medium text-teal-300 hover:text-teal-200">
                              Open customer
                            </Link>
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4">
                        <Link href="/messages" className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                          View LINE message history
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Vehicle</p>
                  {job.vehicle.last_service_date == null && (
                    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
                      No previous service date recorded. Review and confirm vehicle details below.
                    </div>
                  )}
                  <dl className="mt-4 divide-y divide-gray-800 text-sm">
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Make / Model</dt>
                      <dd className="text-right font-medium text-gray-200">
                        {MAKE_LABELS[job.vehicle.make] ?? job.vehicle.make} {job.vehicle.model}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Year</dt>
                      <dd className="text-right font-medium text-gray-200">{job.vehicle.year}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Color</dt>
                      <dd className="text-right font-medium text-gray-200">{job.vehicle.color ?? '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Last service</dt>
                      <dd className="text-right font-medium text-gray-200">
                        {job.vehicle.last_service_date
                          ? new Date(job.vehicle.last_service_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'No history'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Odometer (km)</dt>
                      <dd className="text-right font-medium text-gray-200">
                        {job.vehicle.current_mileage != null ? `${job.vehicle.current_mileage.toLocaleString()} km` : '—'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Service request</p>
                  <dl className="mt-4 divide-y divide-gray-800 text-sm">
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Logistics</dt>
                      <dd className="text-right font-medium text-gray-200">
                        {job.logistics_type === 'pickup' ? 'Pickup' : 'Drop-off'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-gray-500">Mechanic notes</dt>
                      <dd className="text-right font-medium text-gray-200">{job.mechanic_notes ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 rounded-2xl bg-gray-950 px-4 py-4 text-sm italic leading-6 text-gray-300">
                    {job.description.includes(' / ')
                      ? job.description.split(' / ')[1] ?? job.description.split(' / ')[0]
                      : job.description}
                  </div>
                </section>

                <section id="job-quote" className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Quote line items</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {currentInvoice?.invoice_number ?? 'Draft quote'}
                        {currentInvoice ? ` (${currentInvoice.status})` : ''}
                      </p>
                    </div>
                    {!addingItem && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAddingItem(true)}
                          className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800"
                        >
                          + Add from catalog / ad-hoc item
                        </button>
                      </div>
                    )}
                  </div>

                  {addingItem && (
                    <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-800 p-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search product catalog…"
                          value={productSearch}
                          onChange={(e) => handleProductSearchChange(e.target.value)}
                          className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
                        />
                        {productResults.length > 0 && (
                          <div className="absolute z-10 mt-2 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 shadow-lg">
                            {productResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => selectProduct(p)}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-800"
                              >
                                <span className="text-gray-200">{p.name.includes(' / ') ? p.name.split(' / ')[1] : p.name}</span>
                                <span className="text-gray-500">฿{p.sale_price.toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                        <select
                          value={itemType}
                          onChange={(e) => setItemType(e.target.value as 'labour' | 'part')}
                          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="labour">Labour</option>
                          <option value="part">Part</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Description"
                          value={itemDesc}
                          onChange={(e) => setItemDesc(e.target.value)}
                          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={itemQty}
                          onChange={(e) => setItemQty(e.target.value)}
                          placeholder="Qty"
                          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          min="0"
                          value={itemCostPrice}
                          onChange={(e) => setItemCostPrice(e.target.value)}
                          placeholder="Cost"
                          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          min="0"
                          value={itemSalePrice}
                          onChange={(e) => setItemSalePrice(e.target.value)}
                          placeholder="Price"
                          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingItem(false)
                            setItemDesc('')
                            setItemSalePrice('')
                            setItemCostPrice('')
                            setProductSearch('')
                            setProductResults([])
                          }}
                          className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddLineItem}
                          disabled={itemSaving || !itemDesc.trim() || !itemSalePrice}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {itemSaving ? 'Adding…' : 'Add line item'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 overflow-hidden rounded-2xl border border-gray-800">
                    <table className="min-w-full divide-y divide-gray-800 text-sm">
                      <thead className="bg-gray-800 text-left text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 font-medium">Qty</th>
                          <th className="px-4 py-3 font-medium">Cost</th>
                          <th className="px-4 py-3 font-medium text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-900">
                        {job.line_items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                              No quote items yet.
                            </td>
                          </tr>
                        ) : (
                          job.line_items.map((li) => (
                            <tr key={li.id}>
                              <td className="px-4 py-3 text-gray-200">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {li.description.includes(' / ') ? li.description.split(' / ')[1] : li.description}
                                  </span>
                                  {li.is_scope_change && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                                      Scope
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-400">{li.quantity}</td>
                              <td className="px-4 py-3 text-gray-400">
                                {li.cost_price != null ? li.cost_price.toLocaleString() : '—'}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-100">
                                ฿{(li.sale_price * li.quantity).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-gray-900">
                        <tr className="border-t-2 border-gray-700">
                          <td className="px-4 py-3 text-base font-semibold text-white">Total</td>
                          <td colSpan={2} />
                          <td className="px-4 py-3 text-right text-base font-semibold text-white">
                            ฿{lineItemsTotal.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <section id="job-contact" className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Send quote</p>
                    {currentInvoice && (
                      <a
                        href={`/api/invoices/${currentInvoice.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Note to customer (sent with quote)
                  </p>
                  <textarea
                    className="mt-2 min-h-[110px] w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
                    value={msgText}
                    onChange={(e) => { setMsgText(e.target.value); setMsgResult(null) }}
                    placeholder="Add a note for the customer before sending the quote link."
                  />
                  {msgResult && (
                    <p className={`mt-3 text-sm ${msgResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {msgResult.text}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSendQuoteLink}
                      disabled={sendingQuoteLink || !job.customer.line_id}
                      className="flex-1 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {sendingQuoteLink ? 'Sending…' : 'Send quote via LINE'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={sendingMsg || !msgText.trim()}
                      className="rounded-2xl border border-gray-700 bg-gray-900 px-5 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 disabled:opacity-50"
                    >
                      {sendingMsg ? 'Sending…' : 'Send note only'}
                    </button>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Status</p>
                  <div className="mt-4 rounded-2xl bg-gray-800 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Bucket</p>
                    <p className="mt-2 text-base font-semibold text-gray-100">{BUCKET_LABELS[job.bucket]}</p>
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Status
                    </label>
                    <select
                      value={job.status}
                      onChange={(e) => { void handleStatusChange(e.target.value as JobStatus) }}
                      disabled={saving}
                      className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {validStatuses.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status] ?? status}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Assignment</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Revenue stream
                      </label>
                      <select
                        value={job.revenue_stream ?? ''}
                        onChange={(e) => { void handleRevenueStreamChange(e.target.value) }}
                        className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      >
                        {REVENUE_STREAM_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl bg-gray-800 px-4 py-3 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={job.logistics_type === 'pickup'}
                        readOnly
                        className="mt-0.5 h-4 w-4 rounded border-gray-700 text-emerald-600"
                      />
                      <span>Tag transport revenue stream automatically for pickup jobs.</span>
                    </label>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Mechanic
                      </label>
                      <select
                        value={mechanicEdit}
                        onChange={(e) => { void handleMechanicChange(e.target.value) }}
                        disabled={saving}
                        className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Not assigned</option>
                        {mechanicOptions.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </select>
                    </div>

                    {currentInvoice && (
                      <div className="rounded-2xl bg-gray-800 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Deposit</p>
                        <p className="mt-2 text-sm text-gray-200">
                          {currentInvoice.deposit_amount
                            ? `Paid: ฿${currentInvoice.deposit_amount.toLocaleString()}`
                            : 'No deposit recorded'}
                        </p>
                        {!recordingDeposit ? (
                          <button
                            type="button"
                            onClick={() => setRecordingDeposit(true)}
                            className="mt-3 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
                          >
                            Record deposit
                          </button>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <input
                              type="number"
                              min="1"
                              placeholder="Amount"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                            />
                            <select
                              value={depositMethod}
                              onChange={(e) => setDepositMethod(e.target.value as typeof depositMethod)}
                              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                            >
                              <option value="bank_transfer">Bank Transfer</option>
                              <option value="promptpay">PromptPay</option>
                              <option value="credit_card">Credit Card</option>
                              <option value="cash">Cash</option>
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setRecordingDeposit(false); setDepositAmount('') }}
                                className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleRecordDeposit}
                                disabled={depositSaving || !depositAmount}
                                className="flex-1 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
                              >
                                {depositSaving ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Timeline</p>
                  <div className="mt-4 space-y-4">
                    {timelineEntries.map((entry, index) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                          {index < timelineEntries.length - 1 && <span className="mt-1 h-full w-px bg-gray-800" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium text-gray-100">{entry.label}</p>
                          <p className="mt-1 text-xs text-gray-400">{entry.detail}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {new Date(entry.changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '}
                            {new Date(entry.changedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {(job.scope_changes.length > 0 || workOrders.length > 0) && (
                  <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Operations</p>
                    <div className="mt-4 space-y-4">
                      {job.scope_changes.map((sc) => (
                        <div key={sc.id} className="rounded-2xl border border-gray-800 bg-gray-800 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-100">{sc.description}</p>
                              {sc.mechanic_notes && <p className="mt-1 text-xs text-gray-400">{sc.mechanic_notes}</p>}
                            </div>
                            <span className="text-sm font-semibold text-gray-100">฿{sc.amount_thb.toLocaleString()}</span>
                          </div>
                          {sc.status === 'flagged' && (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleScopeAction(sc.id, 'decline')}
                                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                onClick={() => handleScopeAction(sc.id, 'approve')}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                              >
                                Approve
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {workOrders.map((wo) => (
                        <div key={wo.id} className="rounded-2xl border border-gray-800 bg-gray-800 p-4">
                          <p className="text-sm font-medium text-gray-100">
                            {wo.order_type === 'pickup' ? 'Pickup order' : 'Delivery order'}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {(drivers.find((driver) => driver.id === wo.driver_id)?.full_name ?? 'Unassigned driver')}
                          </p>
                          {(wo.pickup_address || wo.delivery_address) && (
                            <p className="mt-1 text-xs text-gray-500">{wo.pickup_address ?? wo.delivery_address}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
}
