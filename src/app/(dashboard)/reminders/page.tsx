'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type Decision = 'sent' | 'skipped' | null

interface ReminderVehicle {
  id: string
  make: string
  model: string
  year: number
  color: string | null
  primary_photo_url: string | null
  last_service_date: string | null
}

interface ReminderCustomer {
  id: string
  full_name: string
  line_id: string | null
  preferred_language: string | null
}

interface Reminder {
  id: string
  vehicle_id: string
  customer_id: string
  reminder_type: '90_day' | '180_day'
  eligible_since: string
  decision: Decision
  reviewed_at: string | null
  sent_at: string | null
  message_content: string | null
  created_at: string
  vehicle: ReminderVehicle | null
  customer: ReminderCustomer | null
}

type Tab = 'pending' | 'sent' | 'skipped'
type DayFilter = 'all' | '90' | '180'

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function buildPreviewMessage(reminder: Reminder): string {
  const v = reminder.vehicle
  if (!v) return ''
  const days = reminder.reminder_type === '180_day' ? '180' : '90'
  const vehicleStr = `${v.make} ${v.model} ${v.year}`
  const thai = `🔧 Butler Garage\n\nครบ ${days} วันแล้วที่รถของคุณไม่ได้รับการบริการ\n${vehicleStr}\nถึงเวลาเช็คสภาพรถหรือยังครับ? ติดต่อเราเพื่อนัดหมายได้เลย\n\n—\nButler Garage | Bangkok`
  const english = `🔧 Butler Garage\n\nIt's been ${days} days since your ${vehicleStr} was last serviced.\nTime for a check-up? Contact us to book your next service.\n\n—\nButler Garage | Bangkok`
  const lang = reminder.customer?.preferred_language
  if (lang === 'th') return thai
  if (lang === 'en') return english
  return `${thai}\n\n---\n\n${english}`
}

export default function RemindersPage() {
  const { toast } = useToast()

  const [tab, setTab] = useState<Tab>('pending')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [loading, setLoading] = useState(true)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [acting, setActing] = useState<string | null>(null)

  const [previewReminder, setPreviewReminder] = useState<Reminder | null>(null)

  const fetchReminders = useCallback(async () => {
    setLoading(true)
    try {
      let decisionParam = ''
      if (tab === 'pending') decisionParam = 'null'
      else if (tab === 'sent') decisionParam = 'sent'
      else if (tab === 'skipped') decisionParam = 'skipped'

      const res = await fetch(`/api/reminders?decision=${decisionParam}`)
      const json = await res.json()
      setReminders(json.data ?? [])
    } catch {
      toast('Failed to load reminders', 'error')
    } finally {
      setLoading(false)
    }
  }, [tab, toast])

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  const pendingCount = reminders.filter((r) => r.decision === null).length

  const filteredReminders = reminders.filter((r) => {
    if (tab !== 'pending') return true
    if (dayFilter === '90') return r.reminder_type === '90_day'
    if (dayFilter === '180') return r.reminder_type === '180_day'
    return true
  })

  async function handleAction(reminder: Reminder, action: 'send' | 'skip') {
    setActing(reminder.id)
    try {
      const res = await fetch(`/api/reminders/${reminder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error?.message ?? `Failed to ${action} reminder`, 'error')
        return
      }
      toast(action === 'send' ? 'Reminder sent' : 'Reminder skipped', 'success')
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id))
    } catch {
      toast(`Failed to ${action} reminder`, 'error')
    } finally {
      setActing(null)
    }
  }

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: 'pending', label: `Pending${tab === 'pending' ? ` (${filteredReminders.length})` : ''}` },
    { key: 'sent', label: 'Sent' },
    { key: 'skipped', label: 'Skipped' },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header title="Service Reminders" />

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-gray-800">
        <div className="flex gap-1">
          {TAB_LABELS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Day filter pills — Pending tab only */}
      {tab === 'pending' && (
        <div className="px-6 pt-3 pb-1 flex gap-2">
          {(['all', '90', '180'] as DayFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDayFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                dayFilter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : `${f} days`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400 text-sm">
              {tab === 'pending' ? 'No pending reminders' : `No ${tab} reminders`}
            </p>
            <p className="text-gray-600 text-xs mt-1">
              {tab === 'pending' ? 'All caught up!' : 'Nothing to show yet.'}
            </p>
          </div>
        ) : tab === 'pending' ? (
          <div className="space-y-3 max-w-3xl">
            {filteredReminders.map((r) => (
              <PendingCard
                key={r.id}
                reminder={r}
                acting={acting === r.id}
                onSend={() => handleAction(r, 'send')}
                onSkip={() => handleAction(r, 'skip')}
                onPreview={() => setPreviewReminder(r)}
              />
            ))}
          </div>
        ) : (
          <LogTable reminders={filteredReminders} tab={tab} />
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        open={!!previewReminder}
        onClose={() => setPreviewReminder(null)}
        title="Message Preview"
        size="md"
      >
        {previewReminder && (
          <div>
            <div className="text-xs text-gray-500 mb-3">
              This is the message that will be sent to{' '}
              <span className="text-gray-300">{previewReminder.customer?.full_name}</span>
            </div>
            <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap font-sans border border-gray-700">
              {buildPreviewMessage(previewReminder)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

interface PendingCardProps {
  reminder: Reminder
  acting: boolean
  onSend: () => void
  onSkip: () => void
  onPreview: () => void
}

function PendingCard({ reminder, acting, onSend, onSkip, onPreview }: PendingCardProps) {
  const v = reminder.vehicle
  const c = reminder.customer
  const daysSinceService = v?.last_service_date ? daysBetween(v.last_service_date) : null

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* Vehicle photo */}
        <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0 overflow-hidden">
          {v?.primary_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.primary_photo_url}
              alt={`${v.make} ${v.model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg">
              🏍
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">
            {v ? `${v.make} ${v.model} (${v.year})` : '—'}
            {v?.color && <span className="text-gray-400 font-normal"> — {v.color}</span>}
          </div>

          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>
              Customer: <span className="text-gray-200">{c?.full_name ?? '—'}</span>
            </span>
            <span>
              LINE:{' '}
              <span className={c?.line_id ? 'text-emerald-400' : 'text-red-400'}>
                {c?.line_id ? '✓' : '✗'}
              </span>
            </span>
          </div>

          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {v?.last_service_date && (
              <span>
                Last service:{' '}
                <span className="text-gray-200">{formatDate(v.last_service_date)}</span>
                {daysSinceService != null && (
                  <span className="text-gray-500"> ({daysSinceService} days ago)</span>
                )}
              </span>
            )}
            <span>
              Reminder type:{' '}
              <span className="text-indigo-300">
                {reminder.reminder_type === '90_day' ? '90-day' : '180-day'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
        <button
          onClick={onPreview}
          disabled={acting}
          className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          Preview Message
        </button>
        <button
          onClick={onSkip}
          disabled={acting}
          className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          onClick={onSend}
          disabled={acting || !c?.line_id}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 ml-auto"
          title={!c?.line_id ? 'Customer has no LINE ID' : undefined}
        >
          {acting ? 'Sending...' : 'Send Reminder'}
        </button>
      </div>
    </div>
  )
}

function LogTable({ reminders, tab }: { reminders: Reminder[]; tab: 'sent' | 'skipped' }) {
  return (
    <table className="w-full text-sm max-w-4xl">
      <thead>
        <tr className="border-b border-gray-700">
          <th className="text-left py-2 pr-4 font-medium text-gray-400">Vehicle</th>
          <th className="text-left py-2 pr-4 font-medium text-gray-400">Customer</th>
          <th className="text-left py-2 pr-4 font-medium text-gray-400 whitespace-nowrap">Type</th>
          <th className="text-left py-2 font-medium text-gray-400 whitespace-nowrap">
            {tab === 'sent' ? 'Date Sent' : 'Date Skipped'}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {reminders.map((r) => (
          <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
            <td className="py-2.5 pr-4 text-white">
              {r.vehicle
                ? `${r.vehicle.make} ${r.vehicle.model} (${r.vehicle.year})`
                : '—'}
            </td>
            <td className="py-2.5 pr-4 text-gray-300">{r.customer?.full_name ?? '—'}</td>
            <td className="py-2.5 pr-4">
              <span className="text-xs text-indigo-300">
                {r.reminder_type === '90_day' ? '90-day' : '180-day'}
              </span>
            </td>
            <td className="py-2.5 text-gray-400 text-xs">
              {tab === 'sent' && r.sent_at
                ? formatDate(r.sent_at)
                : r.reviewed_at
                ? formatDate(r.reviewed_at)
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
