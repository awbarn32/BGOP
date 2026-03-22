'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { JobStatus, Bucket } from '@/types/domain'

// ─── Thai labels ────────────────────────────────────────────
const TH = {
  title: 'งานของฉัน',
  subtitle: 'Butler Garage',
  noJobs: 'ไม่มีงานที่รับผิดชอบ',
  noJobsSub: 'ผู้จัดการจะมอบหมายงานให้คุณ',
  noCompleted: 'ไม่มีงานที่เสร็จสิ้น',
  noCompletedSub: 'งานที่เสร็จสิ้นใน 7 วันที่ผ่านมาจะแสดงที่นี่',
  loading: 'กำลังโหลด...',
  notes: 'บันทึกช่าง',
  notesPlaceholder: 'เพิ่มบันทึกเกี่ยวกับงานนี้...',
  saveNotes: 'บันทึก',
  mileage: 'เลขไมล์เมื่อเสร็จ (กม.)',
  scopeFlag: 'แจ้งงานนอกขอบเขต',
  scopeDesc: 'รายละเอียดงานเพิ่มเติม',
  scopeDescPlaceholder: 'อธิบายงานที่ต้องทำเพิ่มเติม...',
  scopeNotes: 'หมายเหตุ',
  scopeNotesPlaceholder: 'ข้อมูลเพิ่มเติม...',
  scopeSubmit: 'ส่งรายงาน',
  scopeCancel: 'ยกเลิก',
  scopePending: 'รอการอนุมัติ',
  statusLabel: 'สถานะ',
  logout: 'ออกจากระบบ',
  saved: 'บันทึกแล้ว',
  error: 'เกิดข้อผิดพลาด',
  tabActive: 'กำลังซ่อม',
  tabCompleted: 'เสร็จแล้ว',
  lineItems: 'รายการงาน',
  part: 'อะไหล่',
  labour: 'ค่าแรง',
  clockIn: 'เช็คอินเริ่มงาน',
  clockOut: 'เช็คเอาท์',
  clockedIn: 'กำลังทำงาน',
  partsSection: 'ขอชิ้นส่วน',
  partsRequest: 'แจ้งขอชิ้นส่วน',
  partsDesc: 'รายละเอียดชิ้นส่วน',
  partsDescPlaceholder: 'เช่น น้ำมันเครื่อง 10W-40, 4 ลิตร',
  partsQty: 'จำนวน',
  partsSubmit: 'ส่งคำขอ',
  partsCancel: 'ยกเลิก',
  partsRequested: 'ส่งคำขอแล้ว',
  partsApproved: 'อนุมัติแล้ว',
  partsOrdered: 'สั่งซื้อแล้ว',
  partsReceived: 'รับแล้ว',
  partsDeclined: 'ปฏิเสธ',
}

const STATUS_TH: Record<string, string> = {
  new: 'ใหม่', under_review: 'กำลังตรวจสอบ', awaiting_customer: 'รอลูกค้า',
  quote_sent: 'ส่งใบเสนอราคาแล้ว', confirmed: 'ยืนยันแล้ว',
  awaiting_drop_off: 'รอรับรถ', driver_assigned: 'มอบหมายคนขับแล้ว',
  picked_up: 'รับรถแล้ว', in_transit: 'กำลังเดินทาง',
  received_at_shop: 'รถถึงอู่แล้ว', awaiting_assignment: 'รอมอบหมาย',
  awaiting_parts: 'รอชิ้นส่วน', awaiting_approval: 'รอการอนุมัติ',
  work_started: 'เริ่มงาน', paused_parts: 'หยุด — รอชิ้นส่วน',
  paused_approval: 'หยุด — รอการอนุมัติ', work_completed: 'งานเสร็จสิ้น',
  awaiting_pickup: 'รอรับรถกลับ', driver_assigned_delivery: 'มอบหมายคนขับส่งคืน',
  out_for_delivery: 'กำลังส่งรถคืน', returned_to_customer: 'ส่งคืนแล้ว',
}

const MAKE_SHORT: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson', other: 'Other',
}

const MECHANIC_STATUS_ACTIONS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'work_started', label: 'เริ่มงาน', color: 'bg-emerald-700 hover:bg-emerald-600' },
  { status: 'paused_parts', label: 'หยุด — รอชิ้นส่วน', color: 'bg-amber-700 hover:bg-amber-600' },
  { status: 'paused_approval', label: 'หยุด — รอการอนุมัติ', color: 'bg-amber-700 hover:bg-amber-600' },
  { status: 'work_completed', label: 'งานเสร็จสิ้น', color: 'bg-indigo-700 hover:bg-indigo-600' },
]

const PARTS_STATUS_COLOR: Record<string, string> = {
  requested: 'bg-amber-900/60 text-amber-300',
  approved: 'bg-emerald-900/60 text-emerald-300',
  ordered: 'bg-blue-900/60 text-blue-300',
  received: 'bg-emerald-700/60 text-emerald-200',
  declined: 'bg-red-900/60 text-red-300',
}

const PARTS_STATUS_TH: Record<string, string> = {
  requested: TH.partsRequested,
  approved: TH.partsApproved,
  ordered: TH.partsOrdered,
  received: TH.partsReceived,
  declined: TH.partsDeclined,
}

interface LineItem {
  id: string
  description: string
  quantity: number
  line_type: string
}

interface PartsRequest {
  id: string
  description: string
  quantity: number
  status: string
  pa_notes: string | null
}

interface MechanicJob {
  id: string
  bucket: Bucket
  status: JobStatus
  priority: number
  description: string
  mechanic_notes: string | null
  intake_mileage: number | null
  completion_mileage: number | null
  customer: { id: string; full_name: string }
  vehicle: { make: string; model: string; year: number; license_plate: string | null; current_mileage: number | null }
  scope_changes: { id: string; description: string; status: string; created_at: string }[]
  line_items: LineItem[]
}

interface ActiveSession {
  id: string
  job_id: string
  clocked_in_at: string
}

function useElapsed(clockedInAt: string | null) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!clockedInAt) { setElapsed(''); return }
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 1000)
      const h = Math.floor(diff / 3600).toString().padStart(2, '0')
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
      const s = (diff % 60).toString().padStart(2, '0')
      setElapsed(`${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [clockedInAt])
  return elapsed
}

export default function MechanicPage() {
  const [activeJobs, setActiveJobs] = useState<MechanicJob[]>([])
  const [completedJobs, setCompletedJobs] = useState<MechanicJob[]>([])
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)

  // Per-job edit state
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})
  const [mileageMap, setMileageMap] = useState<Record<string, string>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})

  // Parts requests
  const [partsMap, setPartsMap] = useState<Record<string, PartsRequest[]>>({})
  const [partsJobId, setPartsJobId] = useState<string | null>(null)
  const [partsForm, setPartsForm] = useState({ description: '', quantity: '1' })
  const [partsSaving, setPartsSaving] = useState(false)

  // Scope change modal
  const [scopeJobId, setScopeJobId] = useState<string | null>(null)
  const [scopeForm, setScopeForm] = useState({ description: '', notes: '' })
  const [scopeSaving, setScopeSaving] = useState(false)

  const elapsed = useElapsed(activeSession?.clocked_in_at ?? null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/mechanic/time-logs')
      const json = await res.json()
      setActiveSession(json.data ?? null)
    } catch { /* silent */ }
  }, [])

  const fetchParts = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/parts-requests?job_id=${jobId}`)
      const json = await res.json()
      setPartsMap((p) => ({ ...p, [jobId]: json.data ?? [] }))
    } catch { /* silent */ }
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetch('/api/mechanic/jobs'),
        fetch('/api/mechanic/jobs?completed=true'),
      ])
      const [activeJson, completedJson] = await Promise.all([
        activeRes.json(),
        completedRes.json(),
      ])
      const active: MechanicJob[] = activeJson.data ?? []
      const completed: MechanicJob[] = completedJson.data ?? []
      setActiveJobs(active)
      setCompletedJobs(completed)
      const n: Record<string, string> = {}
      const m: Record<string, string> = {}
      active.forEach((j) => {
        n[j.id] = j.mechanic_notes ?? ''
        m[j.id] = j.completion_mileage != null ? String(j.completion_mileage) : ''
      })
      setNotesMap(n)
      setMileageMap(m)
    } catch {
      showToast(TH.error, false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    fetchSession()
  }, [fetchJobs, fetchSession])

  // Fetch parts when job is expanded
  const prevExpandedRef = useRef<string | null>(null)
  useEffect(() => {
    if (expandedId && expandedId !== prevExpandedRef.current) {
      fetchParts(expandedId)
    }
    prevExpandedRef.current = expandedId
  }, [expandedId, fetchParts])

  async function clockIn(jobId: string) {
    setSavingMap((p) => ({ ...p, [jobId]: true }))
    try {
      const res = await fetch('/api/mechanic/time-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setActiveSession(json.data)
      // Also set job status to work_started
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'work_started' }),
      })
      setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'work_started' } : j))
      showToast('เช็คอินแล้ว ✓')
    } catch {
      showToast(TH.error, false)
    } finally {
      setSavingMap((p) => ({ ...p, [jobId]: false }))
    }
  }

  async function clockOut(reason: 'completed' | 'awaiting_parts' | 'awaiting_approval') {
    if (!activeSession) return
    setSavingMap((p) => ({ ...p, [activeSession.job_id]: true }))
    try {
      const res = await fetch('/api/mechanic/time-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: activeSession.id, reason }),
      })
      if (!res.ok) throw new Error()
      setActiveSession(null)

      // Map reason to job status
      const statusMap: Record<string, JobStatus> = {
        completed: 'work_completed',
        awaiting_parts: 'paused_parts',
        awaiting_approval: 'paused_approval',
      }
      const newStatus = statusMap[reason]
      if (newStatus) {
        await fetch(`/api/jobs/${activeSession.job_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        setActiveJobs((prev) => prev.map((j) => j.id === activeSession.job_id ? { ...j, status: newStatus } : j))
      }
      showToast(TH.saved)
      if (reason === 'completed') fetchJobs()
    } catch {
      showToast(TH.error, false)
    } finally {
      setSavingMap((p) => ({ ...p, [activeSession?.job_id ?? '']: false }))
    }
  }

  async function updateStatus(jobId: string, status: JobStatus) {
    setSavingMap((p) => ({ ...p, [jobId]: true }))
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setActiveJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status } : j))
      showToast(TH.saved)
    } catch {
      showToast(TH.error, false)
    } finally {
      setSavingMap((p) => ({ ...p, [jobId]: false }))
    }
  }

  async function saveNotes(jobId: string) {
    setSavingMap((p) => ({ ...p, [jobId]: true }))
    try {
      const payload: Record<string, unknown> = {
        mechanic_notes: notesMap[jobId]?.trim() || null,
      }
      if (mileageMap[jobId]) payload.completion_mileage = parseInt(mileageMap[jobId], 10)
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      showToast(TH.saved)
    } catch {
      showToast(TH.error, false)
    } finally {
      setSavingMap((p) => ({ ...p, [jobId]: false }))
    }
  }

  async function submitPartsRequest() {
    if (!partsJobId) return
    setPartsSaving(true)
    try {
      const res = await fetch('/api/parts-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: partsJobId,
          description: partsForm.description.trim(),
          quantity: parseInt(partsForm.quantity, 10) || 1,
        }),
      })
      if (!res.ok) throw new Error()
      showToast('ส่งคำขอแล้ว ✓')
      setPartsJobId(null)
      setPartsForm({ description: '', quantity: '1' })
      fetchParts(partsJobId)
    } catch {
      showToast(TH.error, false)
    } finally {
      setPartsSaving(false)
    }
  }

  async function submitScopeChange() {
    if (!scopeJobId) return
    setScopeSaving(true)
    try {
      const res = await fetch(`/api/jobs/${scopeJobId}/scope-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: scopeForm.description.trim(),
          mechanic_notes: scopeForm.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      showToast('รายงานแล้ว')
      setScopeJobId(null)
      setScopeForm({ description: '', notes: '' })
      fetchJobs()
    } catch {
      showToast(TH.error, false)
    } finally {
      setScopeSaving(false)
    }
  }

  const thaiDesc = (desc: string) => desc.includes(' / ') ? desc.split(' / ')[0] : desc
  const vehicleLabel = (v: MechanicJob['vehicle']) =>
    `${v.year} ${MAKE_SHORT[v.make] ?? v.make} ${v.model}${v.license_plate ? ` · ${v.license_plate}` : ''}`
  const bucketColor: Record<string, string> = {
    new_requests: 'border-blue-500', intake: 'border-amber-500',
    available_jobs: 'border-purple-500', wip: 'border-emerald-500', outbound: 'border-teal-500',
  }

  const jobs = tab === 'active' ? activeJobs : completedJobs

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{TH.title}</h1>
          <p className="text-xs text-gray-500">{TH.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
              {activeJobs.length} งาน
            </span>
          )}
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-gray-500 hover:text-white transition-colors py-1">
              {TH.logout}
            </button>
          </form>
        </div>
      </header>

      {/* Clock-in status bar */}
      {activeSession && (
        <div className="bg-blue-950 border-b border-blue-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-blue-200 font-medium">{TH.clockedIn}</span>
            <span className="text-sm font-mono text-white">{elapsed}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => clockOut('awaiting_parts')}
              className="text-xs px-2.5 py-1.5 bg-amber-900/60 text-amber-300 rounded-lg"
            >
              รอชิ้นส่วน
            </button>
            <button
              onClick={() => clockOut('completed')}
              className="text-xs px-2.5 py-1.5 bg-emerald-900/60 text-emerald-300 rounded-lg"
            >
              เสร็จงาน ✓
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="sticky top-[57px] z-10 bg-gray-950 border-b border-gray-800 px-4 pt-3 pb-0 flex gap-1"
        style={{ top: activeSession ? '89px' : '57px' }}>
        {(['active', 'completed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpandedId(null) }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
              tab === t
                ? 'text-white border-indigo-500 bg-gray-900'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {t === 'active' ? TH.tabActive : TH.tabCompleted}
            {t === 'active' && activeJobs.length > 0 && !loading && (
              <span className="ml-1.5 text-xs bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded-full">
                {activeJobs.length}
              </span>
            )}
            {t === 'completed' && completedJobs.length > 0 && !loading && (
              <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                {completedJobs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg ${
          toast.ok ? 'bg-emerald-800 text-emerald-100' : 'bg-red-900 text-red-100'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Content */}
      <main className="p-3 space-y-3 pb-20">
        {loading ? (
          <div className="flex justify-center items-center pt-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-3xl">🏍️</div>
            <p className="text-base font-semibold text-gray-300">
              {tab === 'active' ? TH.noJobs : TH.noCompleted}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tab === 'active' ? TH.noJobsSub : TH.noCompletedSub}
            </p>
          </div>
        ) : (
          jobs.map((job) => {
            const isExpanded = expandedId === job.id
            const saving = savingMap[job.id] ?? false
            const hasPendingScope = job.scope_changes.some((s) => s.status === 'flagged' || s.status === 'pending')
            const approvedItems = job.line_items ?? []
            const jobParts = partsMap[job.id] ?? []
            const isClockedIntoThis = activeSession?.job_id === job.id

            return (
              <div
                key={job.id}
                className={`bg-gray-900 rounded-xl border-l-4 ${bucketColor[job.bucket] ?? 'border-gray-700'} border border-r-gray-800 border-t-gray-800 border-b-gray-800 overflow-hidden`}
              >
                {/* Card header */}
                <button
                  className="w-full text-left px-4 py-3 active:bg-gray-800 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{job.customer.full_name}</p>
                      <p className="text-sm text-gray-400 truncate">{vehicleLabel(job.vehicle)}</p>
                      <p className="text-sm text-gray-300 mt-1 line-clamp-2">{thaiDesc(job.description)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        job.status === 'work_completed' ? 'bg-indigo-900 text-indigo-200' :
                        job.status === 'work_started' ? 'bg-emerald-900 text-emerald-200' :
                        job.status.startsWith('paused') ? 'bg-amber-900 text-amber-200' :
                        job.status === 'returned_to_customer' ? 'bg-teal-900 text-teal-200' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {STATUS_TH[job.status] ?? job.status}
                      </span>
                      {isClockedIntoThis && (
                        <span className="text-xs flex items-center gap-1 text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          {elapsed}
                        </span>
                      )}
                      {hasPendingScope && (
                        <span className="text-xs bg-orange-900/60 text-orange-300 px-2 py-0.5 rounded-full">
                          รอการอนุมัติ
                        </span>
                      )}
                      <span className="text-gray-600 text-lg leading-none">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-4 space-y-5">

                    {/* Work description */}
                    <div className="bg-gray-800/60 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-gray-500 mb-1">รายละเอียดงาน</p>
                      <p className="text-sm text-gray-300">{thaiDesc(job.description)}</p>
                    </div>

                    {/* Approved line items */}
                    {approvedItems.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{TH.lineItems}</p>
                        <div className="space-y-1.5">
                          {approvedItems.map((li) => (
                            <div key={li.id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                li.line_type === 'part' ? 'bg-blue-900/60 text-blue-300' : 'bg-purple-900/60 text-purple-300'
                              }`}>
                                {li.line_type === 'part' ? TH.part : TH.labour}
                              </span>
                              <span className="text-sm text-gray-200 flex-1">{li.description}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">×{li.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clock in/out — active tab only */}
                    {tab === 'active' && job.bucket === 'wip' && (
                      <div>
                        {!isClockedIntoThis && !activeSession && (
                          <button
                            disabled={saving}
                            onClick={() => clockIn(job.id)}
                            className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
                          >
                            ⏱ {TH.clockIn}
                          </button>
                        )}
                        {isClockedIntoThis && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">{TH.clockOut}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => clockOut('awaiting_parts')}
                                disabled={saving}
                                className="py-3 rounded-xl text-sm font-semibold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50"
                              >
                                หยุด — รอชิ้นส่วน
                              </button>
                              <button
                                onClick={() => clockOut('awaiting_approval')}
                                disabled={saving}
                                className="py-3 rounded-xl text-sm font-semibold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-50"
                              >
                                หยุด — รออนุมัติ
                              </button>
                              <button
                                onClick={() => clockOut('completed')}
                                disabled={saving}
                                className="col-span-2 py-3 rounded-xl text-sm font-semibold bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-50"
                              >
                                ✓ งานเสร็จสิ้น
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manual status buttons — active tab, no clock-in requirement */}
                    {tab === 'active' && job.bucket === 'wip' && !isClockedIntoThis && activeSession && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">เปลี่ยนสถานะ</p>
                        <div className="grid grid-cols-2 gap-2">
                          {MECHANIC_STATUS_ACTIONS.map((action) => (
                            <button
                              key={action.status}
                              disabled={saving || job.status === action.status}
                              onClick={() => updateStatus(job.id, action.status)}
                              className={`py-3 rounded-xl text-sm font-semibold transition-colors ${action.color} text-white
                                ${job.status === action.status ? 'ring-2 ring-white/30' : 'opacity-80'}
                                disabled:cursor-not-allowed`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes — active tab */}
                    {tab === 'active' && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1.5">{TH.notes}</label>
                          <textarea
                            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[80px]"
                            value={notesMap[job.id] ?? ''}
                            onChange={(e) => setNotesMap((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder={TH.notesPlaceholder}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1.5">{TH.mileage}</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={mileageMap[job.id] ?? ''}
                            onChange={(e) => setMileageMap((p) => ({ ...p, [job.id]: e.target.value }))}
                            placeholder={job.vehicle.current_mileage != null ? String(job.vehicle.current_mileage) : '—'}
                          />
                        </div>
                        <button
                          disabled={saving}
                          onClick={() => saveNotes(job.id)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
                        >
                          {saving ? 'กำลังบันทึก...' : TH.saveNotes}
                        </button>
                      </>
                    )}

                    {/* Notes read-only — completed tab */}
                    {tab === 'completed' && job.mechanic_notes && (
                      <div className="bg-gray-800/50 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-gray-500 mb-1">{TH.notes}</p>
                        <p className="text-sm text-gray-300">{job.mechanic_notes}</p>
                      </div>
                    )}

                    {/* Parts requests */}
                    {tab === 'active' && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{TH.partsSection}</p>
                        {jobParts.length > 0 && (
                          <div className="space-y-1.5">
                            {jobParts.map((pr) => (
                              <div key={pr.id} className="bg-gray-800/60 rounded-lg px-3 py-2 flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-200">{pr.description}</p>
                                  {pr.pa_notes && <p className="text-xs text-gray-500 mt-0.5">{pr.pa_notes}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span className="text-xs text-gray-400">×{pr.quantity}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PARTS_STATUS_COLOR[pr.status] ?? 'bg-gray-700 text-gray-300'}`}>
                                    {PARTS_STATUS_TH[pr.status] ?? pr.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setPartsJobId(job.id)}
                          className="w-full py-2.5 border border-dashed border-gray-600 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                        >
                          + {TH.partsRequest}
                        </button>
                      </div>
                    )}

                    {/* Scope changes */}
                    {job.scope_changes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">งานนอกขอบเขต</p>
                        {job.scope_changes.map((sc) => (
                          <div key={sc.id} className="bg-gray-800 rounded-xl px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                sc.status === 'approved' ? 'bg-emerald-900 text-emerald-300' :
                                sc.status === 'declined' ? 'bg-red-900 text-red-300' :
                                'bg-orange-900 text-orange-300'
                              }`}>
                                {sc.status === 'approved' ? 'อนุมัติแล้ว' :
                                 sc.status === 'declined' ? 'ปฏิเสธ' : TH.scopePending}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300">{sc.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Flag scope change — active tab */}
                    {tab === 'active' && (
                      <button
                        onClick={() => setScopeJobId(job.id)}
                        className="w-full py-3 bg-orange-900/50 hover:bg-orange-900 border border-orange-800 rounded-xl text-sm font-semibold text-orange-300 transition-colors"
                      >
                        🚩 {TH.scopeFlag}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>

      {/* Parts request modal */}
      {partsJobId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setPartsJobId(null)}>
          <div className="w-full bg-gray-900 rounded-t-2xl p-5 space-y-4 border-t border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">+ {TH.partsRequest}</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{TH.partsDesc}</label>
              <textarea
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[80px]"
                value={partsForm.description}
                onChange={(e) => setPartsForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={TH.partsDescPlaceholder}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{TH.partsQty}</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={partsForm.quantity}
                onChange={(e) => setPartsForm((p) => ({ ...p, quantity: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPartsJobId(null)} className="flex-1 py-3 bg-gray-800 rounded-xl text-sm font-semibold text-gray-300">
                {TH.partsCancel}
              </button>
              <button
                disabled={partsSaving || !partsForm.description.trim()}
                onClick={submitPartsRequest}
                className="flex-1 py-3 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
              >
                {partsSaving ? 'กำลังส่ง...' : TH.partsSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scope change modal */}
      {scopeJobId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setScopeJobId(null)}>
          <div className="w-full bg-gray-900 rounded-t-2xl p-5 space-y-4 border-t border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">🚩 {TH.scopeFlag}</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{TH.scopeDesc}</label>
              <textarea
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[80px]"
                value={scopeForm.description}
                onChange={(e) => setScopeForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={TH.scopeDescPlaceholder}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{TH.scopeNotes}</label>
              <textarea
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[60px]"
                value={scopeForm.notes}
                onChange={(e) => setScopeForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={TH.scopeNotesPlaceholder}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setScopeJobId(null)} className="flex-1 py-3 bg-gray-800 rounded-xl text-sm font-semibold text-gray-300">
                {TH.scopeCancel}
              </button>
              <button
                disabled={scopeSaving || !scopeForm.description.trim()}
                onClick={submitScopeChange}
                className="flex-1 py-3 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
              >
                {scopeSaving ? 'กำลังส่ง...' : TH.scopeSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
