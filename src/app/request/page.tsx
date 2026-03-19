'use client'

import { useState } from 'react'

// ─── Bilingual labels ─────────────────────────────────────────────────────────
const L = {
  th: {
    title: 'บัตเลอร์ การาจ',
    subtitle: 'จองบริการออนไลน์',
    step: 'ขั้นตอน',
    of: 'จาก',
    next: 'ถัดไป →',
    back: '← ย้อนกลับ',
    submit: 'ส่งคำขอ',
    submitting: 'กำลังส่ง...',
    successTitle: 'รับคำขอแล้ว!',
    successBody: 'ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง',
    steps: [
      { title: 'ข้อมูลติดต่อ', sub: 'ชื่อและเบอร์โทร' },
      { title: 'รถของคุณ', sub: 'ยี่ห้อและรุ่น' },
      { title: 'บริการที่ต้องการ', sub: 'เลือกประเภทงาน' },
      { title: 'รายละเอียด', sub: 'อธิบายปัญหา' },
      { title: 'การรับ-ส่งรถ', sub: 'วิธีการนำรถมา' },
      { title: 'ยืนยัน', sub: 'ตรวจสอบข้อมูล' },
    ],
    fullName: 'ชื่อ-นามสกุล *',
    phone: 'เบอร์โทร *',
    lineId: 'LINE ID (ไม่บังคับ)',
    lang: 'ภาษาที่ต้องการ',
    consent: 'ยินยอมรับการแจ้งเตือนผ่าน LINE / SMS',
    make: 'ยี่ห้อรถ *',
    model: 'รุ่น *',
    year: 'ปีผลิต *',
    plate: 'ทะเบียน (ไม่บังคับ)',
    mileage: 'เลขไมล์ปัจจุบัน (ไม่บังคับ)',
    serviceType: 'ประเภทบริการ *',
    description: 'อธิบายปัญหา / งานที่ต้องการ *',
    descPlaceholder: 'เช่น: เปลี่ยนถ่ายน้ำมันเครื่อง, เสียงดังผิดปกติที่เครื่องยนต์...',
    logistics: 'วิธีนำรถมา',
    preferredDate: 'วันที่ต้องการ (ไม่บังคับ)',
    dropOff: 'นำรถมาเอง (Drop-off)',
    pickup: 'ให้มารับรถถึงบ้าน (Pick-up)',
    logisticsNote: '*บริการรับรถถึงบ้านขึ้นอยู่กับพื้นที่',
    review: {
      contact: 'ข้อมูลติดต่อ',
      vehicle: 'ข้อมูลรถ',
      service: 'บริการ',
      logistics: 'การรับ-ส่ง',
    },
  },
  en: {
    title: 'Butler Garage',
    subtitle: 'Online Service Booking',
    step: 'Step',
    of: 'of',
    next: 'Next →',
    back: '← Back',
    submit: 'Submit Request',
    submitting: 'Submitting...',
    successTitle: 'Request Received!',
    successBody: 'Our team will contact you within 24 hours.',
    steps: [
      { title: 'Contact Info', sub: 'Name & phone number' },
      { title: 'Your Bike', sub: 'Make & model' },
      { title: 'Service Type', sub: 'What do you need?' },
      { title: 'Details', sub: 'Describe the issue' },
      { title: 'Logistics', sub: 'How to bring your bike' },
      { title: 'Confirm', sub: 'Review & submit' },
    ],
    fullName: 'Full Name *',
    phone: 'Phone Number *',
    lineId: 'LINE ID (optional)',
    lang: 'Preferred Language',
    consent: 'I agree to receive updates via LINE / SMS',
    make: 'Make *',
    model: 'Model *',
    year: 'Year *',
    plate: 'License Plate (optional)',
    mileage: 'Current Mileage (optional)',
    serviceType: 'Service Type *',
    description: 'Describe the issue / work needed *',
    descPlaceholder: 'e.g. Oil change, strange engine noise, brake check...',
    logistics: 'How to bring your bike',
    preferredDate: 'Preferred Date (optional)',
    dropOff: 'I\'ll drop it off myself',
    pickup: 'Please pick it up from my location',
    logisticsNote: '*Pick-up service subject to location availability',
    review: {
      contact: 'Contact',
      vehicle: 'Vehicle',
      service: 'Service',
      logistics: 'Logistics',
    },
  },
}

const MAKES = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'Ducati', 'BMW', 'Triumph', 'KTM', 'Royal Enfield', 'Benelli', 'CFMoto', 'Other']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i)

type ServiceType = 'service' | 'transport' | 'dlt' | 'sourcing' | 'ecu' | 'track_day' | 'bike_hotel' | 'other'
const SERVICE_OPTIONS: { value: ServiceType; th: string; en: string }[] = [
  { value: 'service', th: 'ซ่อม / บำรุง', en: 'Service / Repair' },
  { value: 'dlt', th: 'งานทะเบียน (DLT)', en: 'Registration (DLT)' },
  { value: 'sourcing', th: 'จัดหาอะไหล่', en: 'Parts Sourcing' },
  { value: 'ecu', th: 'แผงวงจร ECU', en: 'ECU Tuning' },
  { value: 'transport', th: 'ขนส่งรถ', en: 'Transport / Logistics' },
  { value: 'track_day', th: 'Track Day', en: 'Track Day' },
  { value: 'bike_hotel', th: 'ฝากรถ (Bike Hotel)', en: 'Bike Hotel' },
  { value: 'other', th: 'อื่นๆ', en: 'Other' },
]

interface FormData {
  full_name: string
  phone: string
  line_id: string
  preferred_language: 'th' | 'en'
  consent_to_message: boolean
  make: string
  model: string
  year: number | ''
  license_plate: string
  current_mileage: string
  service_type: ServiceType | ''
  description: string
  logistics_type: 'drop_off' | 'pickup' | ''
  preferred_date: string
}

const INITIAL: FormData = {
  full_name: '', phone: '', line_id: '',
  preferred_language: 'th', consent_to_message: false,
  make: '', model: '', year: '', license_plate: '', current_mileage: '',
  service_type: '', description: '',
  logistics_type: '', preferred_date: '',
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400 mb-1 block">{label}</span>
      <input
        {...props}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
      />
    </label>
  )
}

function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400 mb-1 block">{label}</span>
      <select
        {...props}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-indigo-500 appearance-none"
      >
        {children}
      </select>
    </label>
  )
}

export default function RequestPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = L[form.preferred_language]
  const totalSteps = t.steps.length

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0: return form.full_name.trim().length > 0 && form.phone.trim().length >= 6
      case 1: return form.make.trim().length > 0 && form.model.trim().length > 0 && form.year !== ''
      case 2: return form.service_type !== ''
      case 3: return form.description.trim().length >= 5
      case 4: return true
      case 5: return true
      default: return false
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          line_id: form.line_id.trim() || null,
          preferred_language: form.preferred_language,
          consent_to_message: form.consent_to_message,
          make: form.make,
          model: form.model.trim(),
          year: Number(form.year),
          license_plate: form.license_plate.trim() || null,
          current_mileage: form.current_mileage ? parseInt(form.current_mileage, 10) : null,
          service_type: form.service_type,
          description: form.description.trim(),
          logistics_type: form.logistics_type || null,
          preferred_date: form.preferred_date || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message ?? 'Submission failed')
      }
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-900/60 flex items-center justify-center mx-auto mb-6 text-4xl">✓</div>
          <h1 className="text-2xl font-bold text-white mb-3">{t.successTitle}</h1>
          <p className="text-gray-400">{t.successBody}</p>
          {form.line_id && (
            <a
              href={`https://line.me/ti/p/${form.line_id}`}
              className="mt-6 inline-block px-6 py-3 bg-green-700 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
            >
              LINE
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{t.title}</h1>
          <p className="text-xs text-gray-500">{t.subtitle}</p>
        </div>
        {/* Language toggle */}
        <button
          onClick={() => set('preferred_language', form.preferred_language === 'th' ? 'en' : 'th')}
          className="text-sm bg-gray-800 px-3 py-1.5 rounded-full text-gray-300 hover:text-white transition-colors"
        >
          {form.preferred_language === 'th' ? 'EN' : 'ไทย'}
        </button>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-indigo-400">{t.step} {step + 1} {t.of} {totalSteps}</span>
        <span>·</span>
        <span>{t.steps[step].title}</span>
        <span className="text-gray-700">— {t.steps[step].sub}</span>
      </div>

      <main className="p-4 space-y-5 pb-32 max-w-lg mx-auto">
        {/* ── Step 0: Contact ─────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <Input
              label={t.fullName}
              type="text"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              placeholder={form.preferred_language === 'th' ? 'สมชาย ใจดี' : 'John Smith'}
              autoComplete="name"
            />
            <Input
              label={t.phone}
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="08X-XXX-XXXX"
              autoComplete="tel"
            />
            <Input
              label={t.lineId}
              type="text"
              value={form.line_id}
              onChange={(e) => set('line_id', e.target.value)}
              placeholder="@yourlineid"
            />
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consent_to_message}
                onChange={(e) => set('consent_to_message', e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-indigo-500"
              />
              <span className="text-sm text-gray-400">{t.consent}</span>
            </label>
          </>
        )}

        {/* ── Step 1: Vehicle ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Select
              label={t.make}
              value={form.make}
              onChange={(e) => set('make', e.target.value)}
            >
              <option value="">{form.preferred_language === 'th' ? '— เลือกยี่ห้อ —' : '— Select make —'}</option>
              {MAKES.map((m) => <option key={m} value={m.toLowerCase()}>{m}</option>)}
            </Select>
            <Input
              label={t.model}
              type="text"
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
              placeholder={form.preferred_language === 'th' ? 'เช่น CBR650R, MT-07' : 'e.g. CBR650R, MT-07'}
            />
            <Select
              label={t.year}
              value={form.year}
              onChange={(e) => set('year', Number(e.target.value))}
            >
              <option value="">{form.preferred_language === 'th' ? '— เลือกปี —' : '— Select year —'}</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Input
              label={t.plate}
              type="text"
              value={form.license_plate}
              onChange={(e) => set('license_plate', e.target.value)}
              placeholder={form.preferred_language === 'th' ? 'กข 1234 กรุงเทพ' : 'ABC 1234'}
            />
            <Input
              label={t.mileage}
              type="number"
              value={form.current_mileage}
              onChange={(e) => set('current_mileage', e.target.value)}
              placeholder="km"
              min={0}
            />
          </>
        )}

        {/* ── Step 2: Service type ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('service_type', opt.value)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  form.service_type === opt.value
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                }`}
              >
                <p className="font-semibold text-sm">{opt.th}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.en}</p>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 3: Description ─────────────────────────────────────── */}
        {step === 3 && (
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">{t.description}</span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={t.descPlaceholder}
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-xs text-gray-600 mt-1">{form.description.length} / 2000</p>
          </label>
        )}

        {/* ── Step 4: Logistics ────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">{t.logistics}</p>
            {(['drop_off', 'pickup'] as const).map((lt) => (
              <button
                key={lt}
                type="button"
                onClick={() => set('logistics_type', lt)}
                className={`w-full p-4 rounded-xl border text-left transition-colors ${
                  form.logistics_type === lt
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                }`}
              >
                <p className="font-semibold">{lt === 'drop_off' ? t.dropOff : t.pickup}</p>
              </button>
            ))}
            <p className="text-xs text-gray-600">{t.logisticsNote}</p>
            <Input
              label={t.preferredDate}
              type="date"
              value={form.preferred_date}
              onChange={(e) => set('preferred_date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}

        {/* ── Step 5: Review ───────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {[
              {
                label: t.review.contact,
                rows: [
                  form.full_name,
                  form.phone,
                  form.line_id || null,
                  form.consent_to_message
                    ? (form.preferred_language === 'th' ? 'ยินยอมรับแจ้งเตือน' : 'Agreed to notifications')
                    : null,
                ],
              },
              {
                label: t.review.vehicle,
                rows: [
                  `${form.year} ${form.make} ${form.model}`,
                  form.license_plate || null,
                  form.current_mileage ? `${parseInt(form.current_mileage, 10).toLocaleString()} km` : null,
                ],
              },
              {
                label: t.review.service,
                rows: [
                  SERVICE_OPTIONS.find((s) => s.value === form.service_type)?.[form.preferred_language === 'th' ? 'th' : 'en'] ?? '',
                  form.description,
                ],
              },
              {
                label: t.review.logistics,
                rows: [
                  form.logistics_type === 'drop_off' ? t.dropOff : form.logistics_type === 'pickup' ? t.pickup : (form.preferred_language === 'th' ? 'ไม่ระบุ' : 'Not specified'),
                  form.preferred_date || null,
                ],
              },
            ].map(({ label, rows }) => (
              <div key={label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{label}</p>
                {rows.filter(Boolean).map((row, i) => (
                  <p key={i} className="text-sm text-gray-300 leading-relaxed">{row}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 bg-gray-950 border-t border-gray-800 px-4 py-4 flex gap-3 max-w-lg mx-auto">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 font-semibold hover:border-gray-600 transition-colors"
          >
            {t.back}
          </button>
        )}
        {step < totalSteps - 1 ? (
          <button
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold transition-colors disabled:opacity-40"
          >
            {t.next}
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-colors disabled:opacity-50"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        )}
      </div>
    </div>
  )
}
