'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { BUCKET_STATUSES, BUCKET_CONFIG } from '@/types/kanban'
import type { Bucket, JobStatus, User } from '@/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  line_type: string
  description: string
  sku: string | null
  quantity: number
  cost_price: number | null
  sale_price: number
  is_scope_change: boolean
  dlt_passthrough: boolean
  mechanic_completed: boolean
  mechanic_completed_at: string | null
  mechanic_completed_by: string | null
}

interface ScopeChange {
  id: string
  description: string
  amount_thb: number
  status: string
  mechanic_notes: string | null
  created_at: string
}

interface StatusHistoryEvent {
  id: string
  from_status: string | null
  to_status: string
  from_bucket: string | null
  to_bucket: string | null
  changed_at: string
  changed_by: string | null
  notes: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  status: string
  total_amount: number
  deposit_amount: number | null
  paid_amount: number | null
  notes: string | null
  submitted_for_approval_at: string | null
  approved_by: string | null
  approved_at: string | null
  owner_decline_reason: string | null
}

interface JobDetail {
  id: string
  bucket: Bucket
  status: JobStatus
  priority: number
  description: string
  mechanic_notes: string | null
  revenue_stream: string | null
  logistics_type: string | null
  mechanic_id: string | null
  intake_mileage: number | null
  completion_mileage: number | null
  owner_notify_threshold_thb: number
  created_at: string
  updated_at: string
  completed_at: string | null
  archived_at: string | null
  customer: {
    id: string
    full_name: string
    phone: string | null
    line_id: string | null
    preferred_language: string
    notes: string | null
  }
  vehicle: {
    id: string
    make: string
    model: string
    year: number
    license_plate: string | null
    color: string | null
    current_mileage: number | null
  }
  mechanic: { id: string; full_name: string } | null
  line_items: LineItem[]
  status_history: StatusHistoryEvent[]
  scope_changes: ScopeChange[]
  invoice: Invoice[] | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAKE_LABELS: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson',
  aprilia: 'Aprilia', husqvarna: 'Husqvarna', benelli: 'Benelli',
  cfmoto: 'CFMOTO', other: 'Other',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New', under_review: 'Under Review', awaiting_customer: 'Awaiting Customer',
  quote_sent: 'Quote Sent', confirmed: 'Confirmed',
  awaiting_drop_off: 'Awaiting Drop-off', driver_assigned: 'Driver Assigned',
  picked_up: 'Picked Up', in_transit: 'In Transit', received_at_shop: 'Received at Shop',
  awaiting_assignment: 'Awaiting Assignment', awaiting_parts: 'Awaiting Parts',
  awaiting_approval: 'Awaiting Approval',
  work_started: 'Work Started', paused_parts: 'Paused — Parts',
  paused_approval: 'Paused — Approval', work_completed: 'Work Completed',
  awaiting_pickup: 'Awaiting Pickup', driver_assigned_delivery: 'Driver Assigned',
  out_for_delivery: 'Out for Delivery', returned_to_customer: 'Returned',
  withdrawn: 'Withdrawn', rejected: 'Rejected', archived: 'Archived',
}

const REVENUE_STREAMS = [
  { value: 'service', label: 'Service' },
  { value: 'sourcing', label: 'Sourcing' },
  { value: 'track_day', label: 'Track Day' },
  { value: 'transport', label: 'Transport' },
  { value: 'dlt', label: 'DLT' },
  { value: 'bike_hotel', label: 'Bike Hotel' },
  { value: 'commission', label: 'Commission' },
  { value: 'ecu', label: 'ECU' },
]

const INVOICE_STATUS_STYLES: Record<string, string> = {
  quote: 'bg-blue-900/40 text-blue-300',
  pending_owner_approval: 'bg-amber-900/50 text-amber-300',
  owner_declined: 'bg-red-900/40 text-red-300',
  approved: 'bg-emerald-900/40 text-emerald-300',
  deposit_paid: 'bg-teal-900/40 text-teal-300',
  pending: 'bg-amber-900/40 text-amber-300',
  paid: 'bg-green-900/40 text-green-300',
  void: 'bg-gray-800 text-gray-500',
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  quote: 'Quote — Draft',
  pending_owner_approval: '⏳ Awaiting Owner Review',
  owner_declined: '✕ Declined by Owner',
  approved: 'Confirmed',
  deposit_paid: 'Deposit Paid',
  pending: 'Awaiting Payment',
  paid: 'Paid ✓',
  void: 'Void',
}

const LANG_LABELS: Record<string, string> = {
  th: 'Thai',
  en: 'English',
}

// Helper: display job description (show full text as-is)
function displayDesc(raw: string): string {
  return raw
}

// Helper: customer initials for avatar
function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const params = useParams()
  const jobId = params.id as string
  const router = useRouter()
  const { toast } = useToast()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mechanics, setMechanics] = useState<Pick<User, 'id' | 'full_name'>[]>([])
  const [pastJobCount, setPastJobCount] = useState<number | null>(null)

  // Right panel controls
  const [statusEdit, setStatusEdit] = useState<JobStatus | ''>('')
  const [revenueStreamEdit, setRevenueStreamEdit] = useState<string>('')
  const [logisticsEdit, setLogisticsEdit] = useState<string>('')
  const [mechanicEdit, setMechanicEdit] = useState<string>('')
  const [depositMode, setDepositMode] = useState<'none' | 'half' | 'custom'>('none')
  const [customDepositAmount, setCustomDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState<'bank_transfer' | 'promptpay' | 'cash' | 'credit_card'>('bank_transfer')
  const [depositSaving, setDepositSaving] = useState(false)

  // Quote builder
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

  // Quote note
  const [quoteNote, setQuoteNote] = useState('')
  const [quoteNoteSaving, setQuoteNoteSaving] = useState(false)
  const [quoteNoteChanged, setQuoteNoteChanged] = useState(false)

  // Scope change amounts (PA sets when approving)
  const [scopeAmounts, setScopeAmounts] = useState<Record<string, string>>({})

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSaving, setRejectSaving] = useState(false)

  // LINE messaging
  const [sendingQuoteLink, setSendingQuoteLink] = useState(false)
  const [msgResult, setMsgResult] = useState<{ ok: boolean; text: string } | null>(null)

  // Owner approval submission
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Duplicate detection
  const [duplicates, setDuplicates] = useState<Array<{ id: string; full_name: string; phone: string | null; email: string | null; match_reason: string }>>([])
  const [mergingId, setMergingId] = useState<string | null>(null)

  // ─── Fetch job ─────────────────────────────────────────────────────────────

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      const json = await res.json()
      if (!res.ok || !json.data) {
        toast('Job not found', 'error')
        router.push('/board')
        return
      }
      const data: JobDetail = json.data
      setJob(data)
      setStatusEdit(data.status)
      setRevenueStreamEdit(data.revenue_stream ?? '')
      setLogisticsEdit(data.logistics_type ?? '')
      setMechanicEdit(data.mechanic_id ?? '')
      const inv = data.invoice?.[0]
      setQuoteNote(inv?.notes ?? '')
      setQuoteNoteChanged(false)
    } catch {
      toast('Failed to load job', 'error')
    } finally {
      setLoading(false)
    }
  }, [jobId, toast, router])

  useEffect(() => {
    fetchJob()
    // Load mechanics for assignment dropdown
    fetch('/api/users')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data) {
          setMechanics(j.data.filter((u: User) => ['mechanic', 'pa', 'owner'].includes(u.role)))
        }
      })
      .catch(() => {})
  }, [fetchJob])

  // Fetch past job count once customer is known
  useEffect(() => {
    if (!job?.customer?.id) return
    fetch(`/api/jobs?customer_id=${job.customer.id}&count=true`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.count !== undefined) setPastJobCount(j.count)
      })
      .catch(() => {})
  }, [job?.customer?.id])

  // Fetch potential duplicate customers
  useEffect(() => {
    if (!job?.customer?.id) return
    fetch(`/api/customers/${job.customer.id}/duplicates`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j?.data) setDuplicates(j.data)
      })
      .catch(() => {})
  }, [job?.customer?.id])

  // ─── Merge handler ──────────────────────────────────────────────────────────

  async function handleMerge(keepId: string, removeId: string) {
    if (!confirm(`Merge these customers? All jobs, vehicles, and invoices from the duplicate will be moved to the primary record. The duplicate will be deleted.`)) return
    setMergingId(removeId)
    try {
      const res = await fetch(`/api/customers/${keepId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merge_from_id: removeId }),
      })
      if (res.ok) {
        toast('Customers merged successfully', 'success')
        setDuplicates((prev) => prev.filter((d) => d.id !== removeId))
        fetchJob() // Refresh job data
      } else {
        const json = await res.json()
        toast(json.error?.message ?? 'Merge failed', 'error')
      }
    } catch {
      toast('Network error', 'error')
    } finally {
      setMergingId(null)
    }
  }

  // ─── Patch helper ──────────────────────────────────────────────────────────

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
      if (!res.ok) { toast(json.error?.message ?? 'Update failed', 'error'); return }
      setJob(json.data)
      toast('Saved', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Right panel handlers ──────────────────────────────────────────────────

  async function handleStatusChange(newStatus: JobStatus) {
    setStatusEdit(newStatus)
    await patch({ status: newStatus })
  }

  async function handleRevenueStreamChange(val: string) {
    setRevenueStreamEdit(val)
    await patch({ revenue_stream: val || null })
  }

  async function handleLogisticsChange(val: string) {
    setLogisticsEdit(val)
    await patch({ logistics_type: val || null })
  }

  async function handleMechanicChange(val: string) {
    setMechanicEdit(val)
    await patch({ mechanic_id: val || null })
  }

  // ─── Reject handler ────────────────────────────────────────────────────────

  async function handleReject() {
    if (!rejectReason.trim()) { toast('Please enter a rejection reason', 'error'); return }
    setRejectSaving(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' as JobStatus, mechanic_notes: rejectReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to reject', 'error'); return }
      setJob(json.data)
      setRejectOpen(false)
      toast('Job rejected', 'error')
    } catch {
      toast('Network error', 'error')
    } finally {
      setRejectSaving(false)
    }
  }

  // ─── Quote note handler ────────────────────────────────────────────────────

  async function handleSaveQuoteNote() {
    if (!job?.invoice?.[0]) return
    setQuoteNoteSaving(true)
    try {
      const res = await fetch(`/api/invoices/${job.invoice[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: quoteNote.trim() || null }),
      })
      if (!res.ok) { toast('Failed to save note', 'error'); return }
      setQuoteNoteChanged(false)
      toast('Note saved', 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setQuoteNoteSaving(false)
    }
  }

  // ─── Send quote via LINE ───────────────────────────────────────────────────

  async function handleSendQuoteLink() {
    if (!job) return
    setSendingQuoteLink(true)
    setMsgResult(null)
    try {
      const quoteUrl = `${window.location.origin}/quote/${job.id}`
      const isThai = job.customer.preferred_language === 'th'
      const text = isThai
        ? `สวัสดีครับคุณ ${job.customer.full_name},\n\nบัตเลอร์ การาจ ได้เตรียมใบประเมินราคาสำหรับท่านเรียบร้อยแล้ว ท่านสามารถตรวจสอบรายละเอียดและยืนยันผ่านทางลิงก์นี้ได้เลยครับ:\n\n${quoteUrl}`
        : `Hi ${job.customer.full_name},\n\nButler Garage has prepared your service estimate. You can review the details and authorize the services via this link:\n\n${quoteUrl}`

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: job.customer.id, text, recipient_language: job.customer.preferred_language }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsgResult({ ok: false, text: json.error?.message ?? 'Failed to send' })
      } else {
        // Update job status to quote_sent
        await fetch(`/api/jobs/${job.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'quote_sent' as JobStatus }),
        })
        await fetchJob()
        setMsgResult({ ok: true, text: json.demo ? 'Demo mode — logged' : 'Quote link sent via LINE ✓' })
      }
    } catch {
      setMsgResult({ ok: false, text: 'Network error' })
    } finally {
      setSendingQuoteLink(false)
    }
  }

  // ─── Resend quote ──────────────────────────────────────────────────────────

  async function handleResendQuoteLink() {
    setMsgResult(null)
    await handleSendQuoteLink()
  }

  // ─── Submit for owner approval ─────────────────────────────────────────────

  async function handleSubmitForApproval() {
    if (!job?.invoice?.[0]) return
    setSubmittingApproval(true)
    setMsgResult(null)
    try {
      const res = await fetch(`/api/invoices/${job.invoice[0].id}/submit-approval`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setMsgResult({ ok: false, text: json.error?.message ?? 'Failed to submit' })
        return
      }
      await fetchJob()
      setMsgResult({ ok: true, text: 'Quote submitted for owner review ✓' })
    } catch {
      setMsgResult({ ok: false, text: 'Network error' })
    } finally {
      setSubmittingApproval(false)
    }
  }

  // ─── Confirm job ───────────────────────────────────────────────────────────

  async function handleConfirmJob() {
    if (!job) return
    const inv = job.invoice?.[0]
    if (!confirm('Confirm this job? This marks the customer as approved.')) return
    await patch({ status: 'confirmed' as JobStatus })
    if (inv) {
      await fetch(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      await fetchJob()
    }
  }

  // ─── Deposit handler ───────────────────────────────────────────────────────

  async function handleRecordDeposit() {
    if (!job?.invoice?.[0]) return
    const total = job.line_items.reduce((s, li) => s + li.sale_price * li.quantity, 0)
    let amt: number
    if (depositMode === 'half') {
      amt = Math.round(total * 0.5)
    } else if (depositMode === 'custom') {
      amt = parseFloat(customDepositAmount)
      if (isNaN(amt) || amt <= 0) { toast('Invalid deposit amount', 'error'); return }
    } else {
      return
    }
    setDepositSaving(true)
    try {
      const res = await fetch(`/api/invoices/${job.invoice[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deposit_amount: amt, payment_method: depositMethod, status: 'deposit_paid' }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error?.message ?? 'Failed to record deposit', 'error'); return }
      if (job.status !== 'confirmed') {
        await patch({ status: 'confirmed' as JobStatus })
      } else {
        await fetchJob()
      }
      toast(`Deposit of ฿${amt.toLocaleString()} recorded`, 'success')
    } catch {
      toast('Network error', 'error')
    } finally {
      setDepositSaving(false)
    }
  }

  // ─── Line items ────────────────────────────────────────────────────────────

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
      await fetchJob()
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
      setJob((prev) => prev ? { ...prev, line_items: prev.line_items.filter((li) => li.id !== itemId) } : prev)
    } catch { toast('Failed to delete item', 'error') }
  }

  // ─── Scope change handlers ─────────────────────────────────────────────────

  async function handleScopeAction(scopeId: string, action: 'approve' | 'decline') {
    if (!confirm(`${action === 'approve' ? 'Approve' : 'Decline'} this scope change?`)) return
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
      await fetchJob()
      toast(action === 'approve' ? 'Scope change approved' : 'Scope change declined', action === 'approve' ? 'success' : 'error')
    } catch { toast('Network error', 'error') }
  }

  // ─── Computed values ───────────────────────────────────────────────────────

  const inv = job?.invoice?.[0] ?? null
  const lineTotal = job?.line_items.reduce((s, li) => s + li.sale_price * li.quantity, 0) ?? 0
  const costTotal = job?.line_items.reduce((s, li) => s + (li.cost_price ?? 0) * li.quantity, 0) ?? 0
  const validStatuses = job ? BUCKET_STATUSES[job.bucket] : []
  const pendingScopes = job?.scope_changes.filter((sc) => sc.status === 'flagged' || sc.status === 'pending') ?? []
  const canSendQuote = job && job.line_items.length > 0 && !!inv

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!job) return null

  const jobRef = job.id.slice(0, 8).toUpperCase()
  const initials = getInitials(job.customer.full_name)
  const isNewRequest = job.bucket === 'new_requests'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: back + job ref */}
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/board"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <span>←</span> Jobs
            </Link>
            <div className="h-4 w-px bg-gray-700 flex-shrink-0" />
            <span className="font-mono text-sm font-semibold text-indigo-300 flex-shrink-0">
              BG-{jobRef}
            </span>
            <StatusBadge status={job.status} />
            {isNewRequest && (
              <span className="text-xs text-gray-500 italic hidden sm:block">via intake form</span>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {job.customer.line_id && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const url = `https://line.me/ti/p/${job.customer.line_id}`
                  window.open(url, '_blank')
                }}
              >
                💬 Contact
              </Button>
            )}
            {job.status !== 'rejected' && job.status !== 'archived' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRejectOpen(true)}
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 border-red-900/40"
              >
                Reject
              </Button>
            )}
            {job.status === 'quote_sent' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleResendQuoteLink}
                disabled={sendingQuoteLink}
              >
                {sendingQuoteLink ? 'Sending…' : '↺ Resend Quote'}
              </Button>
            )}
            {(job.status === 'new' || job.status === 'under_review' || job.status === 'awaiting_customer') && canSendQuote && inv && (inv.status === 'quote' || inv.status === 'owner_declined') && (
              <Button
                size="sm"
                onClick={handleSubmitForApproval}
                disabled={submittingApproval}
                className="bg-amber-700 hover:bg-amber-600 text-white"
              >
                {submittingApproval ? 'Submitting…' : '📤 Submit for Owner Approval'}
              </Button>
            )}
            {job.status === 'quote_sent' && (
              <Button size="sm" onClick={handleConfirmJob} disabled={saving}>
                ✓ Confirm Job
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Message result banner ─────────────────────────────────────────── */}
      {msgResult && (
        <div className={`mx-6 mt-4 px-4 py-2 rounded-lg text-sm ${msgResult.ok ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/40' : 'bg-red-900/30 text-red-300 border border-red-800/40'}`}>
          {msgResult.text}
          <button onClick={() => setMsgResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Two-column body ──────────────────────────────────────────────────── */}
      <div className="flex gap-6 p-6 items-start">

        {/* ════ LEFT COLUMN — Main content ════════════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── Customer card ────────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Customer</h3>
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
              {/* Customer details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link href={`/customers/${job.customer.id}`} className="text-lg font-semibold text-white hover:text-indigo-300 transition-colors">
                    {job.customer.full_name}
                  </Link>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                    {LANG_LABELS[job.customer.preferred_language] ?? job.customer.preferred_language}
                  </span>
                </div>
                <div className="flex gap-3 mt-1 text-sm text-gray-400 flex-wrap">
                  {job.customer.phone && <span>{job.customer.phone}</span>}
                  {job.customer.line_id && <span className="text-green-400">LINE: {job.customer.line_id}</span>}
                </div>
                {/* Past jobs + LINE history */}
                <div className="flex items-center gap-4 mt-2">
                  {pastJobCount !== null && (
                    <span className="text-xs text-teal-400 font-medium">
                      {pastJobCount > 0 ? `${pastJobCount} past job${pastJobCount !== 1 ? 's' : ''}` : 'New customer'}
                    </span>
                  )}
                  {job.customer.line_id && (
                    <a
                      href={`https://line.me/ti/p/${job.customer.line_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                    >
                      VIEW LINE history →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Duplicate customer alert ──────────────────────────────────────── */}
          {duplicates.length > 0 && (
            <div className="bg-amber-950/50 border border-amber-700/60 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-400 text-sm">⚠</span>
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Potential Duplicate Customer{duplicates.length > 1 ? 's' : ''} Found
                </h3>
              </div>
              <div className="space-y-2">
                {duplicates.map((dup) => (
                  <div key={dup.id} className="flex items-center justify-between bg-gray-900/60 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">{dup.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {dup.phone ?? 'No phone'}{dup.email ? ` · ${dup.email}` : ''}
                      </p>
                      <p className="text-xs text-amber-500 mt-0.5">{dup.match_reason}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <Link
                        href={`/customers/${dup.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleMerge(job.customer.id, dup.id)}
                        disabled={mergingId === dup.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-700 text-white disabled:opacity-50 transition-colors"
                      >
                        {mergingId === dup.id ? 'Merging…' : 'Merge into this'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Vehicle card ─────────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vehicle</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Make</p>
                <p className="text-sm text-white">{MAKE_LABELS[job.vehicle.make] ?? job.vehicle.make}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Model</p>
                <p className="text-sm text-white">{job.vehicle.model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Year</p>
                <p className="text-sm text-white">{job.vehicle.year}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Color</p>
                <p className="text-sm text-white">{job.vehicle.color ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">License Plate</p>
                <p className="text-sm text-white font-mono">{job.vehicle.license_plate ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Odometer (km)</p>
                <p className="text-sm text-white">{job.vehicle.current_mileage?.toLocaleString() ?? '—'}</p>
              </div>
            </div>
            <div className="mt-2">
              <Link
                href={`/vehicles/${job.vehicle.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                View vehicle record →
              </Link>
            </div>
          </div>

          {/* ── Customer description ─────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Job Description</h3>
            <div className="bg-gray-800/60 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-300 italic leading-relaxed">
                {displayDesc(job.description)}
              </p>
            </div>
          </div>

          {/* ── Quote Builder ─────────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">Quote / Invoice</h3>
                {inv && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS_STYLES[inv.status] ?? 'bg-gray-800 text-gray-400'}`}>
                    {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                )}
                {inv?.invoice_number && (
                  <span className="text-xs text-gray-600 font-mono">{inv.invoice_number}</span>
                )}
              </div>
              {!addingItem && inv?.status !== 'paid' && (
                <button
                  onClick={() => setAddingItem(true)}
                  className="text-xs px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium"
                >
                  + Add Item
                </button>
              )}
            </div>

            {/* Add item form */}
            {addingItem && (
              <div className="mb-4 p-4 bg-gray-800/60 rounded-xl border border-gray-700 space-y-3">
                {/* Product search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search product catalog…"
                    value={productSearch}
                    onChange={(e) => handleProductSearchChange(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {productSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">…</span>}
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {productResults.map((p) => (
                        <button key={p.id} onClick={() => selectProduct(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-800 text-sm transition-colors flex items-center justify-between">
                          <span className="text-white">{p.name.includes(' / ') ? p.name.split(' / ')[1] : p.name}</span>
                          <span className="text-gray-500 text-xs ml-2">฿{p.sale_price.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Type + description */}
                <div className="flex gap-2">
                  <select value={itemType} onChange={(e) => setItemType(e.target.value as 'labour' | 'part')}
                    className="px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none">
                    <option value="labour">Labour</option>
                    <option value="part">Part</option>
                  </select>
                  <input type="text" placeholder="Description" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                {/* Qty + prices */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Qty</p>
                    <input type="number" min="0.01" step="0.01" value={itemQty} onChange={(e) => setItemQty(e.target.value)}
                      className="w-full px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cost ฿ <span className="text-gray-600">(internal)</span></p>
                    <input type="number" min="0" placeholder="0" value={itemCostPrice} onChange={(e) => setItemCostPrice(e.target.value)}
                      className="w-full px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Price ฿ <span className="text-gray-600">(customer)</span></p>
                    <input type="number" min="0" placeholder="0" value={itemSalePrice} onChange={(e) => setItemSalePrice(e.target.value)}
                      className="w-full px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setAddingItem(false); setItemDesc(''); setItemSalePrice(''); setItemCostPrice(''); setProductSearch(''); setProductResults([]) }}
                    className="flex-1 py-2 rounded-xl border border-gray-600 text-sm text-gray-400 hover:border-gray-500 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAddLineItem} disabled={itemSaving || !itemDesc.trim() || !itemSalePrice}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white font-medium transition-colors">
                    {itemSaving ? 'Adding…' : 'Add Item'}
                  </button>
                </div>
              </div>
            )}

            {/* Line items table */}
            {job.line_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-3">Item</th>
                      <th className="text-center text-xs text-gray-500 font-medium pb-2 px-2 w-14">Qty</th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 px-2 w-28">
                        Cost ฿ <span className="text-gray-700">(int.)</span>
                      </th>
                      <th className="text-right text-xs text-gray-500 font-medium pb-2 pl-2 w-28">Price ฿</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {job.line_items.map((li) => (
                      <tr key={li.id} className={`group ${li.mechanic_completed ? 'opacity-75' : ''}`}>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                              li.line_type === 'labour' ? 'bg-blue-900/40 text-blue-300' : 'bg-amber-900/40 text-amber-300'
                            }`}>
                              {li.line_type === 'labour' ? 'L' : 'P'}
                            </span>
                            <span className={`${li.mechanic_completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                              {displayDesc(li.description)}
                            </span>
                            {li.is_scope_change && (
                              <span className="text-xs text-orange-400 font-medium">SC</span>
                            )}
                            {li.mechanic_completed && (
                              <span className="text-xs text-emerald-400 font-medium flex-shrink-0">✓ Done</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-center text-gray-400 font-mono">{li.quantity}</td>
                        <td className="py-2.5 text-right text-gray-600 font-mono">
                          {li.cost_price != null ? `฿${(li.cost_price * li.quantity).toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 text-right text-gray-200 font-mono font-medium">
                          ฿{(li.sale_price * li.quantity).toLocaleString()}
                        </td>
                        <td className="py-2.5 pl-2">
                          <button
                            onClick={() => handleDeleteLineItem(li.id)}
                            className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700">
                      <td colSpan={2} className="pt-3 text-xs text-gray-500">
                        {job.line_items.length} item{job.line_items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="pt-3 text-right text-xs text-gray-600 font-mono">
                        ฿{costTotal.toLocaleString()}
                      </td>
                      <td className="pt-3 text-right font-semibold text-white font-mono">
                        ฿{lineTotal.toLocaleString()}
                      </td>
                      <td />
                    </tr>
                    {inv?.deposit_amount != null && (
                      <>
                        <tr>
                          <td colSpan={3} className="pt-1 text-right text-sm text-teal-400">Deposit paid</td>
                          <td className="pt-1 text-right text-sm text-teal-400 font-mono">- ฿{inv.deposit_amount.toLocaleString()}</td>
                          <td />
                        </tr>
                        <tr className="border-t border-gray-700">
                          <td colSpan={3} className="pt-2 text-right text-sm font-bold text-white">Balance due</td>
                          <td className="pt-2 text-right text-sm font-bold text-white font-mono">฿{Math.max(0, lineTotal - inv.deposit_amount).toLocaleString()}</td>
                          <td />
                        </tr>
                      </>
                    )}
                  </tfoot>
                </table>
              </div>
            ) : !addingItem ? (
              <div className="py-8 text-center text-sm text-gray-600 border border-dashed border-gray-800 rounded-xl">
                No items yet — click <strong>+ Add Item</strong> to build the quote
              </div>
            ) : null}

            {/* Quote note textarea */}
            {inv && (
              <div className="mt-4">
                <label className="text-xs text-gray-500 font-medium block mb-1.5">
                  Quote Note <span className="text-gray-600">(visible to customer)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Add a note for the customer about this quote…"
                  value={quoteNote}
                  onChange={(e) => { setQuoteNote(e.target.value); setQuoteNoteChanged(true) }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
                {quoteNoteChanged && (
                  <button
                    onClick={handleSaveQuoteNote}
                    disabled={quoteNoteSaving}
                    className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                  >
                    {quoteNoteSaving ? 'Saving…' : 'Save note'}
                  </button>
                )}
              </div>
            )}

            {/* Approval status banners */}
            {inv?.status === 'pending_owner_approval' && (
              <div className="mt-4 bg-amber-900/20 border border-amber-700/40 rounded-xl p-3">
                <p className="text-sm font-medium text-amber-300">⏳ Awaiting Owner Review</p>
                {inv.submitted_for_approval_at && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Submitted: {new Date(inv.submitted_for_approval_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}
            {inv?.status === 'owner_declined' && (
              <div className="mt-4 bg-red-900/20 border border-red-800/40 rounded-xl p-3">
                <p className="text-sm font-medium text-red-300">✕ Quote Declined by Owner</p>
                {inv.owner_decline_reason && (
                  <p className="text-sm text-red-200 mt-1">{inv.owner_decline_reason}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Please revise and resubmit.</p>
              </div>
            )}

            {/* Language indicator */}
            {inv && inv.status !== 'paid' && inv.status !== 'void' && (
              <div className="mt-3">
                {job.customer.line_id ? (
                  <p className="text-xs text-gray-500">
                    🌐 Quote will be sent in:{' '}
                    <span className="text-gray-400 font-medium">
                      {job.customer.preferred_language === 'th' ? 'Thai' : job.customer.preferred_language === 'en' ? 'English' : 'Bilingual (Thai + English)'}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">⚠️ No LINE ID — customer won't receive the quote automatically</p>
                )}
              </div>
            )}

            {/* Quote action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {canSendQuote && job.status !== 'confirmed' && job.status !== 'rejected' && inv && (inv.status === 'quote' || inv.status === 'owner_declined') && (
                <Button
                  onClick={handleSubmitForApproval}
                  disabled={submittingApproval}
                  className="flex-1 min-w-[180px] bg-amber-700 hover:bg-amber-600 text-white"
                >
                  {submittingApproval ? 'Submitting…' : '📤 Submit for Owner Approval'}
                </Button>
              )}
              {job.status === 'quote_sent' && (
                <Button
                  variant="secondary"
                  onClick={handleResendQuoteLink}
                  disabled={sendingQuoteLink}
                >
                  ↺ Resend
                </Button>
              )}
              {inv && (
                <button
                  onClick={() => window.open(`/quote/${job.id}`, '_blank')}
                  className="px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded-xl hover:border-gray-500 hover:text-white transition-colors"
                >
                  🔗 Preview Quote
                </button>
              )}
            </div>
          </div>

          {/* ── Scope Changes ──────────────────────────────────────────────────── */}
          {(job.scope_changes.length > 0) && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-white">Scope Changes</h3>
                {pendingScopes.length > 0 && (
                  <span className="text-xs bg-orange-900/40 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                    {pendingScopes.length} pending
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {job.scope_changes.map((sc) => (
                  <div key={sc.id} className={`p-4 rounded-xl border ${
                    sc.status === 'flagged' || sc.status === 'pending'
                      ? 'bg-orange-900/10 border-orange-800/40'
                      : sc.status === 'approved'
                      ? 'bg-emerald-900/10 border-emerald-800/30'
                      : 'bg-gray-800/40 border-gray-700/30'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-gray-200">{sc.description}</p>
                        {sc.mechanic_notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">{sc.mechanic_notes}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(sc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          sc.status === 'approved' ? 'bg-emerald-900/40 text-emerald-300'
                            : sc.status === 'declined' ? 'bg-red-900/40 text-red-300'
                            : 'bg-orange-900/40 text-orange-300'
                        }`}>
                          {sc.status === 'flagged' ? 'Pending Review' : sc.status}
                        </span>
                        {sc.amount_thb > 0 && (
                          <span className="text-sm font-mono font-semibold text-white">฿{sc.amount_thb.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    {(sc.status === 'flagged' || sc.status === 'pending') && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Amount ฿"
                          value={scopeAmounts[sc.id] ?? ''}
                          onChange={(e) => setScopeAmounts((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                          className="w-28 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none"
                        />
                        <button onClick={() => handleScopeAction(sc.id, 'approve')}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleScopeAction(sc.id, 'decline')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-red-400 text-xs font-medium rounded-lg transition-colors">
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ════ RIGHT COLUMN — Controls + Timeline ════════════════════════════ */}
        <div className="w-72 xl:w-80 flex-shrink-0 space-y-4">

          {/* ── Job controls card ─────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">

            {/* Bucket display */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Stage</p>
              <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl bg-gray-800`}>
                <span className={`w-2 h-2 rounded-full ${
                  job.bucket === 'new_requests' ? 'bg-blue-400'
                    : job.bucket === 'intake' ? 'bg-amber-400'
                    : job.bucket === 'available_jobs' ? 'bg-purple-400'
                    : job.bucket === 'wip' ? 'bg-emerald-400'
                    : 'bg-teal-400'
                }`} />
                {BUCKET_CONFIG[job.bucket]?.label ?? job.bucket}
              </div>
            </div>

            {/* Status dropdown */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Status</p>
              <select
                value={statusEdit}
                onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
                disabled={saving}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                {validStatuses.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>

            {/* Revenue stream */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Revenue Stream</p>
              <select
                value={revenueStreamEdit}
                onChange={(e) => handleRevenueStreamChange(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">— select —</option>
                {REVENUE_STREAMS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Transport / logistics */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Transport</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLogisticsChange(logisticsEdit === 'pickup' ? '' : 'pickup')}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${
                    logisticsEdit === 'pickup'
                      ? 'bg-amber-900/30 border-amber-700 text-amber-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  🛵 Pickup
                </button>
                <button
                  onClick={() => handleLogisticsChange(logisticsEdit === 'drop_off' ? '' : 'drop_off')}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${
                    logisticsEdit === 'drop_off'
                      ? 'bg-blue-900/30 border-blue-700 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  🚪 Drop-off
                </button>
              </div>
            </div>

            {/* Mechanic assignment */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5">Assigned Mechanic</p>
              <select
                value={mechanicEdit}
                onChange={(e) => handleMechanicChange(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">— unassigned —</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>

            {/* Deposit section */}
            {inv && inv.status !== 'paid' && inv.status !== 'void' && !inv.deposit_amount && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Deposit</p>
                <div className="flex gap-1.5 mb-2">
                  {(['none', 'half', 'custom'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDepositMode(mode)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        depositMode === mode
                          ? 'bg-teal-900/40 border-teal-700 text-teal-300'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      {mode === 'none' ? 'None' : mode === 'half' ? '50%' : 'Custom'}
                    </button>
                  ))}
                </div>
                {depositMode !== 'none' && (
                  <div className="space-y-2 p-3 bg-gray-800/60 rounded-xl border border-gray-700">
                    {depositMode === 'half' && lineTotal > 0 && (
                      <p className="text-sm text-teal-300 font-medium">Amount: ฿{Math.round(lineTotal * 0.5).toLocaleString()}</p>
                    )}
                    {depositMode === 'custom' && (
                      <input
                        type="number"
                        placeholder="Amount ฿"
                        value={customDepositAmount}
                        onChange={(e) => setCustomDepositAmount(e.target.value)}
                        className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none"
                      />
                    )}
                    <select
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value as typeof depositMethod)}
                      className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="promptpay">PromptPay</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cash">Cash</option>
                    </select>
                    <button
                      onClick={handleRecordDeposit}
                      disabled={depositSaving}
                      className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-xs text-white font-medium rounded-lg transition-colors"
                    >
                      {depositSaving ? 'Saving…' : 'Record Deposit'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Show recorded deposit */}
            {inv?.deposit_amount != null && (
              <div className="flex items-center justify-between px-3 py-2 bg-teal-900/20 border border-teal-800/30 rounded-xl">
                <span className="text-xs text-teal-400">Deposit received</span>
                <span className="text-sm font-semibold text-teal-300 font-mono">฿{inv.deposit_amount.toLocaleString()}</span>
              </div>
            )}

            {/* Intake / completion mileage */}
            {(job.intake_mileage || job.completion_mileage) && (
              <div className="space-y-1.5 pt-2 border-t border-gray-800">
                {job.intake_mileage && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Intake mileage</span>
                    <span className="text-gray-300 font-mono">{job.intake_mileage.toLocaleString()} km</span>
                  </div>
                )}
                {job.completion_mileage && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Completion mileage</span>
                    <span className="text-gray-300 font-mono">{job.completion_mileage.toLocaleString()} km</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Timeline ───────────────────────────────────────────────────────── */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Timeline</h3>
            {job.status_history.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-3">No history yet</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-800" />
                <div className="space-y-4">
                  {[...job.status_history]
                    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                    .map((evt, idx) => (
                      <div key={evt.id} className="flex gap-3 relative">
                        <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center z-10 ${
                          idx === 0
                            ? 'bg-indigo-600 border-indigo-500'
                            : 'bg-gray-800 border-gray-700'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-white' : 'bg-gray-600'}`} />
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="text-xs font-medium text-gray-200">
                            → {STATUS_LABELS[evt.to_status] ?? evt.to_status}
                          </p>
                          {evt.from_status && (
                            <p className="text-xs text-gray-600">from {STATUS_LABELS[evt.from_status] ?? evt.from_status}</p>
                          )}
                          {evt.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">{evt.notes}</p>
                          )}
                          <p className="text-xs text-gray-600 mt-0.5">
                            {new Date(evt.changed_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Created at ─────────────────────────────────────────────────────── */}
          <div className="px-2 text-xs text-gray-700 space-y-0.5">
            <p>Created {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p>Updated {new Date(job.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>

      {/* ── Reject modal ──────────────────────────────────────────────────────── */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Reject Job</h2>
            <p className="text-sm text-gray-400 mb-4">Please provide a reason for rejecting this job request.</p>
            <textarea
              rows={4}
              placeholder="Reason for rejection…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectOpen(false); setRejectReason('') }}
                className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectSaving || !rejectReason.trim()}
                className="flex-1 py-2 text-sm text-white bg-red-700 hover:bg-red-600 disabled:opacity-40 rounded-xl font-medium transition-colors"
              >
                {rejectSaving ? 'Rejecting…' : 'Reject Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
