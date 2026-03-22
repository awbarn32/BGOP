'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JobStatus, Bucket } from '@/types/domain'

// ─── Thai labels ────────────────────────────────────────────
const TH = {
  title: 'งานของฉัน',
  subtitle: 'Butler Garage',
  noJobs: 'ไม่มีงานที่รับผิดชอบ',
  noJobsSub: 'ผู้จัดการจะมอบหมายงานให้คุณ',
  loading: 'กำลังโหลด...',
  notes: 'บันทึกช่าง',
  notesPlaceholder: 'เพิ่มบันทึกเกี่ยวกับงานนี้...',
  saveNotes: 'บันทึก',
  mileage: 'เลขไมล์เมื่อเสร็จ (กม.)',
  scopeFlag: 'แจ้งงานนอกขอบเขต',
  scopeDesc: 'รายละเอียดงานเพิ่มเติม',
  scopeDescPlaceholder: 'อธิบายงานที่ต้องทำเพิ่มเติม...',
  scopeAmount: 'ค่าใช้จ่ายโดยประมาณ (บาท)',
  scopeNotes: 'หมายเหตุ',
  scopeNotesPlaceholder: 'ข้อมูลเพิ่มเติม...',
  scopeSubmit: 'ส่งรายงาน',
  scopeCancel: 'ยกเลิก',
  scopePending: 'รอการอนุมัติ',
  scopeFlagged: 'รายงานแล้ว',
  statusLabel: 'สถานะ',
  logout: 'ออกจากระบบ',
  saved: 'บันทึกแล้ว',
  error: 'เกิดข้อผิดพลาด',
}

const STATUS_TH: Record<string, string> = {
  new: 'ใหม่',
  under_review: 'กำลังตรวจสอบ',
  awaiting_customer: 'รอลูกค้า',
  quote_sent: 'ส่งใบเสนอราคาแล้ว',
  confirmed: 'ยืนยันแล้ว',
  awaiting_drop_off: 'รอรับรถ',
  driver_assigned: 'มอบหมายคนขับแล้ว',
  picked_up: 'รับรถแล้ว',
  in_transit: 'กำลังเดินทาง',
  received_at_shop: 'รถถึงอู่แล้ว',
  awaiting_assignment: 'รอมอบหมาย',
  awaiting_parts: 'รอชิ้นส่วน',
  awaiting_approval: 'รอการอนุมัติ',
  work_started: 'เริ่มงาน',
  paused_parts: 'หยุด — รอชิ้นส่วน',
  paused_approval: 'หยุด — รอการอนุมัติ',
  work_completed: 'งานเสร็จสิ้น',
  awaiting_pickup: 'รอรับรถกลับ',
  driver_assigned_delivery: 'มอบหมายคนขับส่งคืน',
  out_for_delivery: 'กำลังส่งรถคืน',
  returned_to_customer: 'ส่งคืนแล้ว',
}

const MAKE_SHORT: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM',
  royal_enfield: 'Royal Enfield', harley_davidson: 'Harley-Davidson', other: 'Other',
}

// WIP statuses a mechanic can set
const MECHANIC_STATUS_ACTIONS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'work_started', label: 'เริ่มงาน', color: 'bg-emerald-700 hover:bg-emerald-600' },
  { status: 'paused_parts', label: 'หยุด — รอชิ้นส่วน', color: 'bg-amber-700 hover:bg-amber-600' },
  { status: 'paused_approval', label: 'หยุด — รอการอนุมัติ', color: 'bg-amber-700 hover:bg-amber-600' },
  { status: 'work_completed', label: 'งานเสร็จสิ้น', color: 'bg-indigo-700 hover:bg-indigo-600' },
]

interface MechanicJob {
  id: string
  bucket: Bucket
  status: JobStatus
  priority: number
  description: string
  mechanic_notes: string | null
  intake_mileage: number | null
  completion_mileage: number | null
  customer: { id: string; full_name: string; phone: string | null; line_id: string | null; preferred_language: string }
  vehicle: { make: string; model: string; year: number; license_plate: string | null; current_mileage: number | null }
  scope_changes: { id: string; description: string; amount_thb: number; status: string; created_at: string }[]
}

export default function MechanicPage() {
  const [jobs, setJobs] = useState<MechanicJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Per-job edit state
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})
  const [mileageMap, setMileageMap] = useState<Record<string, string>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})

  // Scope change modal
  const [scopeJobId, setScopeJobId] = useState<string | null>(null)
  const [scopeForm, setScopeForm] = useState({ description: '', amount: '', notes: '' })
  const [scopeSaving, setScopeSaving] = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/mechanic/jobs')
      const json = await res.json()
      const data: MechanicJob[] = json.data ?? []
      setJobs(data)
      // Seed edit state
      const n: Record<string, string> = {}
      const m: Record<string, string> = {}
      data.forEach((j) => {
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

  useEffect(() => { fetchJobs() }, [fetchJobs])

  async function updateStatus(jobId: string, status: JobStatus) {
    setSavingMap((p) => ({ ...p, [jobId]: true }))
    try {
      const job = jobs.find((item) => item.id === jobId)
      if (!job) throw new Error()
      const res = await fetch(`/api/jobs/${jobId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_bucket: job.bucket, to_status: status }),
      })
      if (!res.ok) throw new Error()
      await fetchJobs()
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
      if (mileageMap[jobId]) {
        payload.completion_mileage = parseInt(mileageMap[jobId], 10)
      }
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

  async function submitScopeChange() {
    if (!scopeJobId) return
    setScopeSaving(true)
    try {
      const res = await fetch(`/api/jobs/${scopeJobId}/scope-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: scopeForm.description.trim(),
          amount_thb: parseFloat(scopeForm.amount) || 0,
          mechanic_notes: scopeForm.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      showToast('รายงานแล้ว')
      setScopeJobId(null)
      setScopeForm({ description: '', amount: '', notes: '' })
      fetchJobs()
    } catch {
      showToast(TH.error, false)
    } finally {
      setScopeSaving(false)
    }
  }

  const thaiDesc = (desc: string) =>
    desc.includes(' / ') ? desc.split(' / ')[0] : desc

  const vehicleLabel = (v: MechanicJob['vehicle']) =>
    `${v.year} ${MAKE_SHORT[v.make] ?? v.make} ${v.model}${v.license_plate ? ` · ${v.license_plate}` : ''}`

  const bucketColor: Record<string, string> = {
    new_requests: 'border-blue-500',
    intake: 'border-amber-500',
    available_jobs: 'border-purple-500',
    wip: 'border-emerald-500',
    outbound: 'border-teal-500',
  }

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
              {jobs.length} งาน
            </span>
          )}
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-gray-500 hover:text-white transition-colors py-1">
              {TH.logout}
            </button>
          </form>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg ${
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
            <p className="text-base font-semibold text-gray-300">{TH.noJobs}</p>
            <p className="text-sm text-gray-500 mt-1">{TH.noJobsSub}</p>
          </div>
        ) : (
          jobs.map((job) => {
            const isExpanded = expandedId === job.id
            const saving = savingMap[job.id] ?? false
            const hasPendingScope = job.scope_changes.some((s) => s.status === 'flagged' || s.status === 'pending')

            return (
              <div
                key={job.id}
                className={`bg-gray-900 rounded-xl border-l-4 ${bucketColor[job.bucket] ?? 'border-gray-700'} border border-r-gray-800 border-t-gray-800 border-b-gray-800 overflow-hidden`}
              >
                {/* Card header — always visible */}
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
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {STATUS_TH[job.status] ?? job.status}
                      </span>
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
                    {/* Contact */}
                    {(job.customer.phone || job.customer.line_id) && (
                      <div className="flex gap-3">
                        {job.customer.phone && (
                          <a
                            href={`tel:${job.customer.phone}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 rounded-xl text-sm font-medium text-white active:bg-gray-700"
                          >
                            📞 {job.customer.phone}
                          </a>
                        )}
                        {job.customer.line_id && (
                          <a
                            href={`https://line.me/ti/p/${job.customer.line_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-900/50 rounded-xl text-sm font-medium text-green-300 active:bg-green-900"
                          >
                            LINE: {job.customer.line_id}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Status actions */}
                    {job.bucket === 'wip' && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">{TH.statusLabel}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {MECHANIC_STATUS_ACTIONS.map((action) => (
                            <button
                              key={action.status}
                              disabled={saving || job.status === action.status}
                              onClick={() => updateStatus(job.id, action.status)}
                              className={`py-3 rounded-xl text-sm font-semibold transition-colors ${action.color} text-white
                                ${job.status === action.status ? 'ring-2 ring-white/30 opacity-100' : 'opacity-80'}
                                disabled:cursor-not-allowed`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">{TH.notes}</label>
                      <textarea
                        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[80px]"
                        value={notesMap[job.id] ?? ''}
                        onChange={(e) => setNotesMap((p) => ({ ...p, [job.id]: e.target.value }))}
                        placeholder={TH.notesPlaceholder}
                      />
                    </div>

                    {/* Completion mileage */}
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

                    {/* Save notes button */}
                    <button
                      disabled={saving}
                      onClick={() => saveNotes(job.id)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
                    >
                      {saving ? 'กำลังบันทึก...' : TH.saveNotes}
                    </button>

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
                              <span className="text-xs text-white font-mono">
                                ฿{sc.amount_thb.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300">{sc.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Flag scope change */}
                    <button
                      onClick={() => setScopeJobId(job.id)}
                      className="w-full py-3 bg-orange-900/50 hover:bg-orange-900 border border-orange-800 rounded-xl text-sm font-semibold text-orange-300 transition-colors"
                    >
                      🚩 {TH.scopeFlag}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>

      {/* Scope change modal */}
      {scopeJobId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setScopeJobId(null)}>
          <div
            className="w-full bg-gray-900 rounded-t-2xl p-5 space-y-4 border-t border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
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
              <label className="block text-xs text-gray-500 mb-1">{TH.scopeAmount}</label>
              <input
                type="number"
                min={0}
                step={100}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={scopeForm.amount}
                onChange={(e) => setScopeForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
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
              <button
                onClick={() => setScopeJobId(null)}
                className="flex-1 py-3 bg-gray-800 rounded-xl text-sm font-semibold text-gray-300"
              >
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
