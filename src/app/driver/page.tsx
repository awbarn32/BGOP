'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Thai labels ────────────────────────────────────────────
const TH = {
  title: 'คำสั่งงาน',
  subtitle: 'Butler Garage',
  noOrders: 'ไม่มีงานที่รับผิดชอบ',
  noOrdersSub: 'ผู้จัดการจะมอบหมายงานให้คุณ',
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

// What the driver can tap to advance status
const NEXT_ACTION: Record<string, { status: string; label: string; color: string } | null> = {
  pending: null, // PA assigns, driver can't self-accept from pending
  assigned: { status: 'en_route', label: 'เริ่มออกเดินทาง', color: 'bg-blue-700 hover:bg-blue-600' },
  en_route: { status: 'arrived', label: 'ถึงที่หมายแล้ว', color: 'bg-amber-700 hover:bg-amber-600' },
  arrived: { status: 'loaded', label: 'บรรทุกรถแล้ว', color: 'bg-amber-700 hover:bg-amber-600' },
  loaded: { status: 'in_transit', label: 'ออกเดินทาง', color: 'bg-blue-700 hover:bg-blue-600' },
  in_transit: { status: 'delivered', label: 'ส่งถึงแล้ว ✓', color: 'bg-emerald-700 hover:bg-emerald-600' },
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

export default function DriverPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/driver/orders')
      const json = await res.json()
      setOrders(json.data ?? [])
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
      const json = await res.json()
      setOrders((prev) => prev.map((o) => o.id === orderId ? json.data : o))
      showToast(TH.saved)
      // If delivered, collapse
      if (newStatus === 'delivered') {
        setTimeout(fetchOrders, 500)
      }
    } catch {
      showToast(TH.error, false)
    } finally {
      setSaving((p) => ({ ...p, [orderId]: false }))
    }
  }

  const thaiDesc = (desc: string) =>
    desc.includes(' / ') ? desc.split(' / ')[0] : desc

  const vehicleLabel = (v: WorkOrder['job']['vehicle']) =>
    `${v.year} ${MAKE_SHORT[v.make] ?? v.make} ${v.model}${v.license_plate ? ` · ${v.license_plate}` : ''}`

  const formatDate = (d: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleDateString('th-TH', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
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
              {orders.length} งาน
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

      <main className="p-3 space-y-3 pb-20">
        {loading ? (
          <div className="flex justify-center items-center pt-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-3xl">🏍️</div>
            <p className="text-base font-semibold text-gray-300">{TH.noOrders}</p>
            <p className="text-sm text-gray-500 mt-1">{TH.noOrdersSub}</p>
          </div>
        ) : (
          orders.map((order) => {
            const isExpanded = expandedId === order.id
            const isSaving = saving[order.id] ?? false
            const nextAction = NEXT_ACTION[order.status]
            const isPickup = order.order_type === 'pickup'

            return (
              <div
                key={order.id}
                className={`bg-gray-900 rounded-xl border-l-4 ${
                  isPickup ? 'border-amber-500' : 'border-teal-500'
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
                          isPickup ? 'bg-amber-900/60 text-amber-300' : 'bg-teal-900/60 text-teal-300'
                        }`}>
                          {isPickup ? `🏍️ ${TH.pickup}` : `📦 ${TH.delivery}`}
                        </span>
                        {order.scheduled_date && (
                          <span className="text-xs text-gray-500">{formatDate(order.scheduled_date)}</span>
                        )}
                      </div>
                      <p className="font-semibold text-white">{order.job.customer.full_name}</p>
                      <p className="text-sm text-gray-400">{vehicleLabel(order.job.vehicle)}</p>
                      {/* Address preview */}
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
                          เปิด Google Maps →
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
                          เปิด Google Maps →
                        </a>
                      </div>
                    )}

                    {/* Customer contact */}
                    <div className="flex gap-3">
                      {order.job.customer.phone && (
                        <a
                          href={`tel:${order.job.customer.phone}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-800 rounded-xl text-sm font-medium text-white active:bg-gray-700"
                        >
                          📞 {order.job.customer.phone}
                        </a>
                      )}
                      {order.job.customer.line_id && (
                        <a
                          href={`https://line.me/ti/p/${order.job.customer.line_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-900/50 rounded-xl text-sm font-medium text-green-300 active:bg-green-900"
                        >
                          LINE
                        </a>
                      )}
                    </div>

                    {/* Job description */}
                    <div className="bg-gray-800 rounded-xl p-3">
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

                    {/* Action button */}
                    {nextAction && (
                      <button
                        disabled={isSaving}
                        onClick={() => advanceStatus(order.id, nextAction.status)}
                        className={`w-full py-4 rounded-xl text-base font-bold text-white transition-colors ${nextAction.color} disabled:opacity-50`}
                      >
                        {isSaving ? 'กำลังบันทึก...' : nextAction.label}
                      </button>
                    )}

                    {order.status === 'delivered' && (
                      <div className="flex items-center justify-center py-4">
                        <span className="text-emerald-400 font-semibold text-lg">✓ ส่งเรียบร้อยแล้ว</span>
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
