'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ─── Bilingual labels ─────────────────────────────────────────────────────────
const L = {
  th: {
    loading: 'กำลังโหลด...',
    notFound: 'ไม่พบใบประเมินราคา',
    notFoundSub: 'ลิงก์นี้อาจหมดอายุหรือไม่ถูกต้อง',
    brand: 'บัตเลอร์ การาจ',
    brandSub: 'กรุงเทพฯ ประเทศไทย',
    quoteFor: 'ใบประเมินราคา',
    ref: 'เลขที่งาน',
    vehicle: 'รถของคุณ',
    services: 'รายการบริการและชิ้นส่วน',
    selectPrompt: 'เลือกบริการที่คุณต้องการอนุมัติ',
    total: 'ยอดรวม',
    deposit: 'มัดจำที่ต้องชำระ (50%)',
    approve: 'อนุมัติบริการที่เลือก',
    decline: 'ปฏิเสธทั้งหมด',
    approveConfirm: 'ยืนยันการอนุมัติ?',
    declineConfirm: 'ยืนยันการปฏิเสธ? ระบบจะยกเลิกใบงานนี้',
    approvedTitle: 'อนุมัติแล้ว! ✓',
    approvedBody: 'ทางร้านได้รับการยืนยันของคุณแล้ว ทีมงานจะติดต่อเร็วๆ นี้',
    declinedTitle: 'ยกเลิกแล้ว',
    declinedBody: 'ได้รับทราบแล้ว หากต้องการติดต่อกรุณาโทรหาเราโดยตรง',
    legal: 'การอนุมัตินี้ถือเป็นการตกลงรับบริการและราคาที่ระบุไว้',
    part: 'อะไหล่',
    labour: 'ค่าแรง',
    noItems: 'ยังไม่มีรายการในใบประเมิน',
    saving: 'กำลังบันทึก...',
    alreadyConfirmed: 'ใบงานนี้ได้รับการยืนยันแล้ว',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Quote not found',
    notFoundSub: 'This link may have expired or is incorrect.',
    brand: 'Butler Garage',
    brandSub: 'Bangkok, Thailand',
    quoteFor: 'Service Estimate',
    ref: 'Reference',
    vehicle: 'Your Vehicle',
    services: 'Services & Parts',
    selectPrompt: 'Select the services you approve',
    total: 'Your Total',
    deposit: 'Deposit Required (50%)',
    approve: 'Approve Selected Services',
    decline: 'Decline All',
    approveConfirm: 'Confirm approval?',
    declineConfirm: 'Confirm decline? This will cancel the job.',
    approvedTitle: 'Approved! ✓',
    approvedBody: 'Butler Garage has received your confirmation. Our team will be in touch shortly.',
    declinedTitle: 'Declined',
    declinedBody: 'Understood. If you change your mind, please call us directly.',
    legal: 'By approving, you agree to the services and pricing listed above.',
    part: 'Part',
    labour: 'Labour',
    noItems: 'No items on this quote yet.',
    saving: 'Saving…',
    alreadyConfirmed: 'This job has already been confirmed.',
  },
}

type Lang = 'th' | 'en'

interface LineItem {
  id: string
  line_type: string
  description: string
  quantity: number
  sale_price: number
  is_scope_change: boolean
}

interface QuoteData {
  job: { id: string; description: string; status: string; revenue_stream: string; created_at: string }
  customer: { full_name: string; preferred_language: string }
  vehicle: { make: string; model: string; year: number; color: string | null; license_plate: string | null } | null
  invoice: {
    id: string
    invoice_number: string | null
    status: string
    total_amount: number
    deposit_amount: number | null
    notes: string | null
    line_items: LineItem[]
  } | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH').format(n)
}

export default function QuotePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lang, setLang] = useState<Lang>('th')
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<'approved' | 'declined' | null>(null)
  const [saving, setSaving] = useState(false)
  const t = L[lang]

  const load = useCallback(async () => {
    const res = await fetch(`/api/quote/${id}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const json = await res.json()
    const d: QuoteData = json.data
    setData(d)
    // Default language from customer preference
    const prefLang = (d.customer?.preferred_language === 'en' ? 'en' : 'th') as Lang
    setLang(prefLang)
    // Default all items to approved
    const allIds = new Set((d.invoice?.line_items ?? []).map((li) => li.id))
    setApproved(allIds)
    // If already confirmed, show approved state
    if (d.job.status === 'confirmed') setResult('approved')
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleDecision(action: 'approve' | 'decline') {
    if (!confirm(action === 'approve' ? t.approveConfirm : t.declineConfirm)) return
    setSaving(true)
    const res = await fetch(`/api/quote/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setSaving(false)
    if (res.ok) setResult(action === 'approve' ? 'approved' : 'declined')
  }

  const lineItems = data?.invoice?.line_items ?? []
  const approvedTotal = lineItems
    .filter((li) => approved.has(li.id))
    .reduce((sum, li) => sum + li.sale_price * li.quantity, 0)
  const depositAmount = data?.invoice?.deposit_amount ?? Math.round(approvedTotal * 0.5)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">{L.th.loading}</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-3xl mb-3">🔧</p>
        <p className="text-white font-semibold text-lg">{L.en.notFound}</p>
        <p className="text-gray-400 text-sm mt-1">{L.en.notFoundSub}</p>
        <p className="text-gray-500 text-sm mt-2">{L.th.notFound}</p>
        <p className="text-gray-500 text-sm">{L.th.notFoundSub}</p>
      </div>
    )
  }

  // Result screens
  if (result === 'approved') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-900 flex items-center justify-center text-3xl mb-4">✓</div>
        <p className="text-xl font-bold text-white mb-2">{t.approvedTitle}</p>
        <p className="text-gray-400 text-sm">{t.approvedBody}</p>
        <p className="mt-6 text-gray-500 text-sm font-semibold">Butler Garage</p>
        <p className="text-gray-600 text-xs">Bangkok, Thailand</p>
      </div>
    )
  }
  if (result === 'declined') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-3xl mb-4">✗</div>
        <p className="text-xl font-bold text-white mb-2">{t.declinedTitle}</p>
        <p className="text-gray-400 text-sm">{t.declinedBody}</p>
        <p className="mt-6 text-gray-500 text-sm font-semibold">Butler Garage</p>
        <p className="text-gray-600 text-xs">Bangkok, Thailand</p>
      </div>
    )
  }

  const v = data?.vehicle
  const vehicleLabel = v ? `${v.year} ${v.make.charAt(0).toUpperCase() + v.make.slice(1)} ${v.model}${v.color ? ` · ${v.color}` : ''}${v.license_plate ? ` · ${v.license_plate}` : ''}` : '—'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-base">🔧 {t.brand}</p>
            <p className="text-xs text-gray-400">{t.brandSub}</p>
          </div>
          {/* Language toggle */}
          <div className="flex gap-1">
            {(['th', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  lang === l ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {l === 'th' ? 'ไทย' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {/* Quote header */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quoteFor}</p>
          <p className="text-xl font-bold text-white mt-0.5">{data?.customer.full_name}</p>
          {data?.invoice?.invoice_number && (
            <p className="text-xs font-mono text-gray-400 mt-1">{t.ref}: {data.invoice.invoice_number}</p>
          )}
        </div>

        {/* Vehicle */}
        {v && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{t.vehicle}</p>
            <p className="text-sm font-medium text-white">{vehicleLabel}</p>
          </div>
        )}

        {/* Line items */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-2">{t.selectPrompt}</p>
          {lineItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">{t.noItems}</p>
          ) : (
            <div className="space-y-2">
              {lineItems.map((li) => {
                const isApproved = approved.has(li.id)
                return (
                  <button
                    key={li.id}
                    onClick={() => setApproved((prev) => {
                      const next = new Set(prev)
                      if (next.has(li.id)) next.delete(li.id)
                      else next.add(li.id)
                      return next
                    })}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      isApproved
                        ? 'bg-emerald-950/50 border-emerald-700'
                        : 'bg-gray-800/50 border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${
                        isApproved ? 'bg-emerald-600 border-emerald-600' : 'border-gray-500'
                      }`}>
                        {isApproved && <span className="text-white text-xs leading-none">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            li.line_type === 'part'
                              ? 'bg-blue-900/60 text-blue-300'
                              : 'bg-purple-900/60 text-purple-300'
                          }`}>
                            {li.line_type === 'part' ? t.part : t.labour}
                          </span>
                          {li.is_scope_change && (
                            <span className="text-xs bg-orange-900/60 text-orange-300 px-1.5 py-0.5 rounded">
                              Additional
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white">{li.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">qty: {li.quantity}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className={`text-sm font-bold ${isApproved ? 'text-white' : 'text-gray-500 line-through'}`}>
                          ฿{fmt(li.sale_price * li.quantity)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Totals */}
        {lineItems.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{t.total}</span>
              <span className="text-xl font-bold text-white">฿{fmt(approvedTotal)}</span>
            </div>
            {depositAmount > 0 && approvedTotal > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <span className="text-xs text-gray-500">{t.deposit}</span>
                <span className="text-sm font-semibold text-amber-400">฿{fmt(depositAmount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Notes from PA */}
        {data?.invoice?.notes && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Note from Butler Garage</p>
            <p className="text-sm text-gray-300">{data.invoice.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-8">
          <button
            onClick={() => handleDecision('approve')}
            disabled={saving || approved.size === 0}
            className="w-full py-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors"
          >
            {saving ? t.saving : t.approve}
          </button>
          <button
            onClick={() => handleDecision('decline')}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-40 text-gray-400 text-sm transition-colors"
          >
            {t.decline}
          </button>
        </div>

        {/* Legal */}
        <p className="text-center text-xs text-gray-600 pb-4">{t.legal}</p>
      </div>
    </div>
  )
}
