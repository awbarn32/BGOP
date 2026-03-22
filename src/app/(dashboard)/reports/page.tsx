'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(n)
}

const STREAM_LABEL: Record<string, string> = {
  service: 'Service', transport: 'Transport', dlt: 'DLT',
  sourcing: 'Sourcing', commission: 'Commission', ecu: 'ECU',
  track_day: 'Track Day', bike_hotel: 'Bike Hotel',
}

const AGING_LABEL: Record<string, string> = {
  current: 'Current', '1_30': '1–30 days', '31_60': '31–60 days',
  '61_90': '61–90 days', '90_plus': '90+ days',
}

const AGING_COLOR: Record<string, string> = {
  current: 'text-emerald-400', '1_30': 'text-yellow-400',
  '31_60': 'text-orange-400', '61_90': 'text-red-400', '90_plus': 'text-red-600',
}

type ReportTab = 'eod' | 'ar_aging' | 'revenue'

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('eod')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [revFrom, setRevFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [revTo, setRevTo] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let url = `/api/reports?type=${tab}`
      if (tab === 'eod') url += `&date=${date}`
      if (tab === 'revenue') url += `&from=${revFrom}&to=${revTo}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading report')
    } finally {
      setLoading(false)
    }
  }, [tab, date, revFrom, revTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  const csvUrls = {
    eod: `/api/reports?type=csv_eod&date=${date}`,
    ar_aging: `/api/reports?type=csv_invoices&from=${new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`,
    revenue: `/api/reports?type=csv_revenue&from=${revFrom}&to=${revTo}`,
  }
  const csvLabel = { eod: '↓ CSV EOD', ar_aging: '↓ CSV AR', revenue: '↓ CSV Revenue' }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Reports"
        actions={
          <a
            href={csvUrls[tab]}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            {csvLabel[tab]}
          </a>
        }
      />

      <div className="p-6 space-y-5 overflow-auto">
        {/* Tab bar */}
        <div className="flex gap-2 bg-gray-900 p-1 rounded-xl w-fit border border-gray-800">
          {(['eod', 'ar_aging', 'revenue'] as ReportTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-indigo-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'eod' ? 'EOD' : t === 'ar_aging' ? 'AR Aging' : 'Revenue'}
            </button>
          ))}
        </div>

        {/* Date controls */}
        {tab === 'eod' && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={fetchReport}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors"
            >
              Load
            </button>
          </div>
        )}

        {tab === 'revenue' && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-400">From</label>
            <input
              type="date"
              value={revFrom}
              onChange={(e) => setRevFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <label className="text-sm text-gray-400">To</label>
            <input
              type="date"
              value={revTo}
              onChange={(e) => setRevTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={fetchReport}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors"
            >
              Load
            </button>
          </div>
        )}

        {/* Content */}
        {loading && (
          <div className="flex justify-center pt-12">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && data && tab === 'eod' && (() => {
          const d = data as {
            date: string
            invoices: { total: number; paid: number; deposit_paid: number; quote: number }
            revenue: { collected: number; deposits: number; net: number; by_stream: Record<string, number>; by_payment_method: Record<string, number> }
            expenses: { total: number; count: number }
            jobs: { new_today: number; by_bucket: Record<string, number> }
          }

          return (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-300">EOD Summary — {d.date}</h2>

              {/* Revenue */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Collected', value: d.revenue.collected, color: 'text-emerald-400' },
                  { label: 'Deposits', value: d.revenue.deposits, color: 'text-amber-400' },
                  { label: 'Net (after expenses)', value: d.revenue.net, color: d.revenue.net >= 0 ? 'text-emerald-400' : 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>฿{fmt(value)}</p>
                  </div>
                ))}
              </div>

              {/* Invoices */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-300 mb-3">Invoices</p>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Total', value: d.invoices.total },
                    { label: 'Paid', value: d.invoices.paid },
                    { label: 'Deposit', value: d.invoices.deposit_paid },
                    { label: 'Quote', value: d.invoices.quote },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-lg font-bold text-white">{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* By stream */}
              {Object.keys(d.revenue.by_stream).length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-300 mb-3">Revenue by Stream</p>
                  <div className="space-y-2">
                    {Object.entries(d.revenue.by_stream).map(([stream, amount]) => (
                      <div key={stream} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{STREAM_LABEL[stream] ?? stream}</span>
                        <span className="text-white font-medium">฿{fmt(amount as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By payment method */}
              {Object.keys(d.revenue.by_payment_method).length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-300 mb-3">Payment Methods</p>
                  <div className="space-y-2">
                    {Object.entries(d.revenue.by_payment_method).map(([method, amount]) => (
                      <div key={method} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 capitalize">{method.replace('_', ' ')}</span>
                        <span className="text-white font-medium">฿{fmt(amount as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses + Jobs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Expenses ({d.expenses.count})</p>
                  <p className="text-xl font-bold text-red-400">฿{fmt(d.expenses.total)}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">New Jobs Today</p>
                  <p className="text-xl font-bold text-white">{d.jobs.new_today}</p>
                </div>
              </div>
            </div>
          )
        })()}

        {!loading && data && tab === 'ar_aging' && (() => {
          const d = data as {
            summary: Record<string, { count: number; amount: number }>
            invoices: Array<{
              id: string; invoice_number: string | null; invoice_date: string;
              total_amount: number; status: string; days_due: number; aging_bucket: string;
              customer: { full_name: string; phone: string | null } | null
            }>
          }
          const buckets = ['current', '1_30', '31_60', '61_90', '90_plus']

          return (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-300">AR Aging</h2>

              {/* Summary buckets */}
              <div className="grid grid-cols-5 gap-2">
                {buckets.map((b) => {
                  const s = d.summary[b]
                  return (
                    <div key={b} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                      <p className={`text-base font-bold ${AGING_COLOR[b]}`}>฿{fmt(s?.amount ?? 0)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{AGING_LABEL[b]}</p>
                      <p className="text-xs text-gray-600">{s?.count ?? 0} inv</p>
                    </div>
                  )
                })}
              </div>

              {/* Invoice list */}
              <div className="space-y-2">
                {d.invoices.map((inv) => (
                  <div key={inv.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white text-sm">{inv.customer?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{inv.invoice_number ?? inv.id.slice(0, 8)} · {inv.invoice_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">฿{fmt(inv.total_amount)}</p>
                      <p className={`text-xs ${AGING_COLOR[inv.aging_bucket]}`}>
                        {inv.days_due <= 0 ? 'Current' : `${inv.days_due}d overdue`}
                      </p>
                    </div>
                  </div>
                ))}
                {d.invoices.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No outstanding invoices</p>
                )}
              </div>
            </div>
          )
        })()}

        {!loading && data && tab === 'revenue' && (() => {
          const d = data as {
            from: string; to: string
            totals: { invoiced: number; collected: number }
            by_stream: Record<string, { invoiced: number; collected: number; count: number }>
          }

          return (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-300">Revenue — {d.from} to {d.to}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Invoiced</p>
                  <p className="text-2xl font-bold text-white">฿{fmt(d.totals.invoiced)}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Collected</p>
                  <p className="text-2xl font-bold text-emerald-400">฿{fmt(d.totals.collected)}</p>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-300 mb-3">By Revenue Stream</p>
                <div className="space-y-3">
                  {Object.entries(d.by_stream).sort(([, a], [, b]) => b.invoiced - a.invoiced).map(([stream, s]) => (
                    <div key={stream}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-400">{STREAM_LABEL[stream] ?? stream} <span className="text-gray-600">({s.count})</span></span>
                        <span className="text-white font-medium">฿{fmt(s.invoiced)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${d.totals.invoiced > 0 ? (s.invoiced / d.totals.invoiced) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
