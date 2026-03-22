'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Thai labels ────────────────────────────────────────────
const TH = {
  title: 'คำสั่งงาน',
  subtitle: 'Butler Garage',
  noOrders: 'ไม่มีงานวันนี้',
  noOrdersSub: 'ผู้จัดการจะมอบหมายงานให้คุณ',
  noUpcoming: 'ไม่มีงานที่กำลังจะมาถึง',
  noDone: 'ยังไม่มีงานที่เสร็จสิ้น',
  loading: 'กำลังโหลด...',
  pickup: 'รับรถ',
  delivery: 'ส่งรถคืน',
  from: 'รับจาก',
  to: 'ส่งไปที่',
  date: 'วันที่',
  notes: 'หมายเหตุ',
  customer: 'ลูกค้า',
  vehicle: 'รถ',
  logout: 'ออกจากระบบ',
  saved: 'บันทึกแล้ว',
  error: 'เกิดข้อผิดพลาด',
  tabToday: 'วันนี้',
  tabUpcoming: 'กำลังจะมา',
  tabDone: 'เสร็จแล้ว',
  photoRequired: '⚠️ ต้องถ่ายรูปก่อนดำเนินการ',
  takePhoto: '📷 ถ่ายรูป',
  photoCount: (n: number) => `ถ่ายแล้ว ${n} รูป`,
  uploading: 'กำลังอัปโหลด...',
  callCustomer: '📞 โทรหาลูกค้า',
  mapsLink: 'เปิด Google Maps →',
}

const STATUS_TH: Record<string, string> = {
  pending: 'รอดำเนินการ',
  assigned: 'รับงานแล้ว',
  en_route: 'กำลังเดินทาง',
  arrived: 'ถึงที่หมาย',
  loaded: 'บรรทุกแล้ว',
  in_transit: 'อยู่ระหว่างขนส่ง',
  delivered: 'ส่งแล้ว',
  cancelled: 'ยกเลิก',
}

// Status transitions — last step (delivered) requires a photo
const NEXT_ACTION: Record<string, { status: string; label: string; color: string; requiresPhoto: boolean } | null> = {
  pending: null,
  assigned: { status: 'en_route', label: 'เริ่มออกเดินทาง', color: 'bg-blue-700 hover:bg-blue-600', requiresPhoto: false },
  en_route: { status: 'arrived', label: 'ถึงที่หมายแล้ว', color: 'bg-amber-700 hover:bg-amber-600', requiresPhoto: false },
  arrived: { status: 'loaded', label: 'บรรทุกรถแล้ว', color: 'bg-amber-700 hover:bg-amber-600', requiresPhoto: false },
  loaded: { status: 'in_transit', label: 'ออกเดินทาง', color: 'bg-blue-700 hover:bg-blue-600', requiresPhoto: false },
  in_transit: { status: 'delivered', label: 'ส่งถึงแล้ว ✓', color: 'bg-emerald-700 hover:bg-emerald-600', requiresPhoto: true },
  delivered: null,
  cancelled: null,
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-700 text-gray-300',
  assigned: 'bg-blue-900 text-blue-200',
  en_route: 'bg-blue-700 text-blue-100',
  arrived: 'bg-amber-900 text-amber-200',
  loaded: 'bg-amber-700 text-amber-100',
  in_transit: 'bg-indigo-900 text-indigo-200',
  delivered: 'bg-emerald-900 text-emerald-200',
  cancelled: 'bg-red-900 text-red-300',
}

const MAKE_SHORT: Record<string, string> = {
  honda: 'Honda', yamaha: 'Yamaha', kawasaki: 'Kawasaki', suzuki: 'Suzuki',
  ducati: 'Ducati', bmw: 'BMW', triumph: 'Triumph', ktm: 'KTM', other: 'Other',
}

interface WorkOrder {
  id: string
  order_type: 'pickup' | 'delivery'
  status: string
  pickup_address: string | null
  delivery_address: string | null
  scheduled_date: string | null
  notes: string | null
  job: {
    id: string
    description: string
    customer: { full_name: string; phone: string | null; line_id: string | null }
    vehicle: { make: string; model: string; year: number; license_plate: string | null }
  }
}

type DriverTab = 'today' | 'upcoming' | 'done'

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return true // unscheduled orders go on today tab
  const today = new Date().toISOString().split('T')[0]
  return dateStr <= today
}

function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr > today
}

export default function DriverPage() {
  const [allOrders, setAllOrders] = useState<WorkOrder[]>([])
  const [doneOrders, setDoneOrders] = useState<WorkOrder[]>([])
  const [tab, setTab] = useState<DriverTab>('today')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchOrders = useCallback(async () => {
    try {
      const [activeRes, doneRes] = await Promise.all([
        fetch('/api/driver/orders'),
        fetch('/api/driver/orders?include_completed=true'),
      ])
      const [activeJson, doneJson] = await Promise.all([
        activeRes.json(),
        doneRes.json(),
      ])
      const active: WorkOrder[] = activeJson.data ?? []
      const all: WorkOrder[] = doneJson.data ?? []
      const done = all.filter((o) => o.status === 'delivered' || o.status === 'cancelled')
      setAllOrders(active)
      setDoneOrders(done)
    } catch {
      showToast(TH.error, false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function advanceStatus(orderId: string, newStatus: string) {
    setSaving((p) => ({ ...p, [orderId]: true }))
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      showToast(TH.saved)
      await fetchOrders()
    } catch {
      showToast(TH.error, false)
    } finally {
      setSaving((p) => ({ ...p, [orderId]: false }))
    }
  }

  async function handlePhotoCapture(file: File, orderId: string) {
    setUploading((p) => ({ ...p, [orderId]: true }))
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${orderId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('driver-photos')
        .upload(path, file, { upsert: false })
      if (error) throw error
      setPhotoCounts((p) => ({ ...p, [orderId]: (p[orderId] ?? 0) + 1 }))
      showToast('ถ่ายรูปแล้ว ✓')
    } catch {
      showToast('อัปโหลดไม่สำเร็จ', false)
    } finally {
      setUploading((p) => ({ ...p, [orderId]: false }))
    }
  }

  function openCamera(orderId: string) {
    setPhotoTargetId(orderId)
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && photoTargetId) {
      handlePhotoCapture(file, photoTargetId)
    }
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  const thaiDesc = (desc: string) =>
    desc.includes(' / ') ? desc.split(' / ')[0] : desc

  const vehicleLabel = (v: WorkOrder['job']['vehicle']) =>
    `${v.year} ${MAKE_SHORT[v.make] ?? v.make} ${v.model}${v.license_plate ? ` · ${v.license_plate}` : ''}`

  const formatDate = (d: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleDateString('th-TH', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  }

  const todayOrders = allOrders.filter((o) => isToday(o.scheduled_date))
  const upcomingOrders = allOrders.filter((o) => isUpcoming(o.scheduled_date))

  const displayOrders: WorkOrder[] = tab === 'today' ? todayOrders
    : tab === 'upcoming' ? upcomingOrders
    : doneOrders

  const tabCounts = {
    today: todayOrders.length,
    upcoming: upcomingOrders.length,
    done: doneOrders.length,
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hidden file input — camera only on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{TH.title}</h1>
          <p className="text-xs text-gray-500">{TH.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-gray-500 hover:text-white transition-colors py-1">
              {TH.logout}
            </button>
          </form>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-[57px] z-10 bg-gray-950 border-b border-gray-800 flex">
        {(['today', 'upcoming', 'done'] as DriverTab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpandedId(null) }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? 'text-white border-indigo-500 bg-gray-900'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {t === 'today' ? TH.tabToday : t === 'upcoming' ? TH.tabUpcoming : TH.tabDone}
            {tabCounts[t] > 0 && !loading && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                t === 'today' ? 'bg-amber-800 text-amber-200' :
                t === 'upcoming' ? 'bg-blue-900 text-blue-300' :
                'bg-gray-700 text-gray-400'
              }`}>
                {tabCounts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg ${
          toast.ok ? 'bg-emerald-800 text-emerald-100' : 'bg-red-900 text-red-100'
        }`}>
          {toast.msg}
        </div>
      )}

      <main className="p-3 space-y-3 pb-20">
        {loading ? (
          <div className="flex justify-center items-center pt-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-3xl">🏍️</div>
            <p className="text-base font-semibold text-gray-300">
              {tab === 'today' ? TH.noOrders : tab === 'upcoming' ? TH.noUpcoming : TH.noDone}
            </p>
            {tab === 'today' && <p className="text-sm text-gray-500 mt-1">{TH.noOrdersSub}</p>}
          </div>
        ) : (
          displayOrders.map((order) => {
            const isExpanded = expandedId === order.id
            const isSaving = saving[order.id] ?? false
            const isUploading = uploading[order.id] ?? false
            const nextAction = NEXT_ACTION[order.status]
            const isPickup = order.order_type === 'pickup'
            const photoCount = photoCounts[order.id] ?? 0
            const canAdvance = !nextAction?.requiresPhoto || photoCount >= 1
            const isDone = order.status === 'delivered' || order.status === 'cancelled'

            return (
              <div
                key={order.id}
                className={`bg-gray-900 rounded-xl border-l-4 ${
                  isPickup ? 'border-purple-500' : 'border-amber-500'
                } border border-r-gray-800 border-t-gray-800 border-b-gray-800 overflow-hidden`}
              >
                {/* Card header */}
                <button
                  className="w-full text-left px-4 py-3 active:bg-gray-800 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Order type badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          isPickup ? 'bg-purple-900/60 text-purple-300' : 'bg-amber-900/60 text-amber-300'
                        }`}>
                          {isPickup ? `🏍️ ${TH.pickup}` : `📦 ${TH.delivery}`}
                        </span>
                        {order.scheduled_date && (
                          <span className="text-xs text-gray-500">{formatDate(order.scheduled_date)}</span>
                        )}
                      </div>
                      <p className="font-semibold text-white">{order.job.customer.full_name}</p>
                      <p className="text-sm text-gray-400">{vehicleLabel(order.job.vehicle)}</p>
                      {(isPickup ? order.pickup_address : order.delivery_address) && (
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {isPickup ? order.pickup_address : order.delivery_address}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? 'bg-gray-700 text-gray-300'}`}>
                        {STATUS_TH[order.status] ?? order.status}
                      </span>
                      <span className="text-gray-600 text-lg leading-none">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                    {/* Addresses */}
                    {order.pickup_address && (
                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">{TH.from}</p>
                        <p className="text-sm text-white">{order.pickup_address}</p>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(order.pickup_address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 mt-1 inline-block"
                        >
                          {TH.mapsLink}
                        </a>
                      </div>
                    )}

                    {order.delivery_address && (
                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">{TH.to}</p>
                        <p className="text-sm text-white">{order.delivery_address}</p>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(order.delivery_address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 mt-1 inline-block"
                        >
                          {TH.mapsLink}
                        </a>
                      </div>
                    )}

                    {/* Job description */}
                    <div className="bg-gray-800/60 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">งาน</p>
                      <p className="text-sm text-gray-300">{thaiDesc(order.job.description)}</p>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1">{TH.notes}</p>
                        <p className="text-sm text-gray-300">{order.notes}</p>
                      </div>
                    )}

                    {/* Customer contact */}
                    <div className="flex gap-3">
                      {order.job.customer.phone && (
                        <a
                          href={`tel:${order.job.customer.phone}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-800 rounded-xl text-sm font-medium text-white active:bg-gray-700"
                        >
                          {TH.callCustomer}
                        </a>
                      )}
                    </div>

                    {/* Photo section — only shown when next action requires photo or photo already taken */}
                    {!isDone && nextAction?.requiresPhoto && (
                      <div className="space-y-2">
                        {!canAdvance && (
                          <div className="bg-yellow-950/50 border border-yellow-800 rounded-xl px-3 py-2.5">
                            <p className="text-sm text-yellow-300">{TH.photoRequired}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openCamera(order.id)}
                            disabled={isUploading}
                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl text-sm font-medium text-gray-300 disabled:opacity-50 transition-colors"
                          >
                            {isUploading ? TH.uploading : TH.takePhoto}
                          </button>
                          {photoCount > 0 && (
                            <span className="text-sm text-emerald-400 font-medium">
                              ✓ {TH.photoCount(photoCount)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action button */}
                    {nextAction && !isDone && (
                      <button
                        disabled={isSaving || !canAdvance}
                        onClick={() => advanceStatus(order.id, nextAction.status)}
                        className={`w-full py-4 rounded-xl text-base font-bold text-white transition-colors ${nextAction.color} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {isSaving ? 'กำลังบันทึก...' : nextAction.label}
                      </button>
                    )}

                    {isDone && (
                      <div className="flex items-center justify-center py-3">
                        <span className={`font-semibold text-base ${
                          order.status === 'delivered' ? 'text-emerald-400' : 'text-gray-500'
                        }`}>
                          {order.status === 'delivered' ? '✓ ส่งเรียบร้อยแล้ว' : 'ยกเลิก'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
