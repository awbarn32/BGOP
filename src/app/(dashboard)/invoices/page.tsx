'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'

export const metadata = undefined // client component — set via Head if needed

// ─── Types ───────────────────────────────────────────────────────────────────
interface Invoice {
  id: string
  invoice_number: string | null
  invoice_date: string
  status: string
  revenue_stream: string
  total_amount: number
  deposit_amount: number | null
  paid_amount: number | null
  payment_method: string | null
  paid_at: string | null
  notes: string | null
  customer: { id: string; full_name: string; phone: string | null } | null
  vehicle: { make: string; model: string; year: number; license_plate: string | null } | null
  job: { id: string; description: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  quote: 'Quote', approved: 'Approved', deposit_paid: 'Deposit Paid',
  pending: 'Pending', paid: 'Paid', void: 'Void',
}

const STATUS_COLOR: Record<string, string> = {
  quote: 'bg-gray-700 text-gray-300',
  approved: 'bg-blue-900 text-blue-200',
  deposit_paid: 'bg-amber-900 text-amber-200',
  pending: 'bg-orange-900 text-orange-200',
  paid: 'bg-emerald-900 text-emerald-200',
  void: 'bg-red-950 text-red-400',
}

const STREAM_LABEL: Record<string, string> = {
  service: 'Service', transport: 'Transport', dlt: 'DLT',
  sourcing: 'Sourcing', commission: 'Commission', ecu: 'ECU',
  track_day: 'Track Day', bike_hotel: 'Bike Hotel',
}

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'promptpay', 'credit_card', 'other']
const STATUS_OPTIONS = ['quote', 'approved', 'deposit_paid', 'pending', 'paid', 'void']

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Payment modal ────────────────────────────────────────────────────────────
function PaymentModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice
  onClose: () => void
  onSaved: (updated: Invoice) => void
}) {
  const [amount, setAmount] = useState(String(invoice.total_amount))
  const [method, setMethod] = useState('cash')
  const [deposit, setDeposit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), payment_method: method, deposit }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      onSaved(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Record Payment</h2>
        <p className="text-sm text-gray-400">{invoice.customer?.full_name} · ฿{fmt(invoice.total_amount)}</p>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <label className="block">
          <span className="text-xs text-gray-500 mb-1 block">Amount (THB)</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-base focus:outline-none focus:border-indigo-500"
          />
        </label>

        <label className="block">
          <span className="text-xs text-gray-500 mb-1 block">Payment Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
          >
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={deposit}
            onChange={(e) => setDeposit(e.target.checked)}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-sm text-gray-400">Record as deposit</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !amount}
            className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/invoices?${params}`)
    const json = await res.json()
    setInvoices(json.data ?? [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  function handlePaymentSaved(updated: Invoice) {
    setInvoices((prev) => prev.map((inv) => inv.id === updated.id ? { ...inv, ...updated } : inv))
    setPayingInvoice(null)
  }

  async function voidInvoice(id: string) {
    if (!confirm('Void this invoice?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    fetchInvoices()
  }

  const totalOutstanding = invoices
    .filter((i) => ['approved', 'deposit_paid', 'pending'].includes(i.status))
    .reduce((s, i) => s + i.total_amount - (i.deposit_amount ?? 0), 0)

  const totalPaidToday = invoices
    .filter((i) => i.status === 'paid' && i.paid_at?.startsWith(new Date().toISOString().split('T')[0]))
    .reduce((s, i) => s + (i.paid_amount ?? i.total_amount), 0)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Invoices"
        actions={
          <a
            href="/api/reports?type=csv_invoices"
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            ↓ CSV
          </a>
        }
      />

      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSaved={handlePaymentSaved}
        />
      )}

      <div className="p-6 space-y-5 overflow-auto">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Outstanding AR</p>
            <p className="text-2xl font-bold text-orange-400">฿{fmt(totalOutstanding)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Collected Today</p>
            <p className="text-2xl font-bold text-emerald-400">฿{fmt(totalPaidToday)}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!statusFilter ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Invoice list */}
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-gray-500 text-center pt-12">No invoices found</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const isExpanded = expandedId === inv.id
              const canPay = ['approved', 'deposit_paid', 'pending'].includes(inv.status)

              return (
                <div
                  key={inv.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                >
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-gray-500">
                            {inv.invoice_number ?? inv.id.slice(0, 8)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[inv.status] ?? 'bg-gray-700 text-gray-300'}`}>
                            {STATUS_LABEL[inv.status] ?? inv.status}
                          </span>
                          <span className="text-xs text-gray-600">{STREAM_LABEL[inv.revenue_stream] ?? inv.revenue_stream}</span>
                        </div>
                        <p className="font-medium text-white truncate">{inv.customer?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{fmtDate(inv.invoice_date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-white">฿{fmt(inv.total_amount)}</p>
                        {inv.deposit_amount && (
                          <p className="text-xs text-amber-400">Dep: ฿{fmt(inv.deposit_amount)}</p>
                        )}
                        <span className="text-gray-600 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-4 space-y-3">
                      {inv.vehicle && (
                        <p className="text-sm text-gray-400">
                          {inv.vehicle.year} {inv.vehicle.make} {inv.vehicle.model}
                          {inv.vehicle.license_plate ? ` · ${inv.vehicle.license_plate}` : ''}
                        </p>
                      )}
                      {inv.job && (
                        <p className="text-xs text-gray-500 line-clamp-2">{inv.job.description}</p>
                      )}
                      {inv.payment_method && (
                        <p className="text-sm text-gray-400">
                          Paid via {inv.payment_method.replace('_', ' ')} · {fmtDate(inv.paid_at)}
                        </p>
                      )}
                      {inv.notes && (
                        <p className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2">{inv.notes}</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          className="px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-800 text-sm text-gray-400 transition-colors"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ↓ PDF
                        </a>
                        {canPay && (
                          <button
                            onClick={() => setPayingInvoice(inv)}
                            className="flex-1 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm font-semibold text-white transition-colors"
                          >
                            Record Payment
                          </button>
                        )}
                        {inv.status !== 'void' && inv.status !== 'paid' && (
                          <button
                            onClick={() => voidInvoice(inv.id)}
                            className="px-4 py-2 rounded-xl border border-red-900 hover:bg-red-950 text-sm text-red-400 transition-colors"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
