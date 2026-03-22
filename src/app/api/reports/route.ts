import { createClient, getSessionUser } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

// GET /api/reports?type=eod&date=YYYY-MM-DD
// GET /api/reports?type=ar_aging
// GET /api/reports?type=revenue&from=YYYY-MM-DD&to=YYYY-MM-DD
// GET /api/reports?type=csv_invoices&from=YYYY-MM-DD&to=YYYY-MM-DD  — returns CSV

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'eod'
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const from = searchParams.get('from') ?? date
  const to = searchParams.get('to') ?? date

  // ── EOD summary ────────────────────────────────────────────────────────────
  if (type === 'eod') {
    const [invoicesResult, jobsResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('status, total_amount, paid_amount, deposit_amount, revenue_stream, payment_method')
        .eq('invoice_date', date)
        .neq('status', 'void'),
      supabase
        .from('jobs')
        .select('bucket, status, revenue_stream')
        .gte('created_at', `${date}T00:00:00Z`)
        .lte('created_at', `${date}T23:59:59Z`),
      supabase
        .from('expenses')
        .select('amount, category')
        .eq('date', date),
    ])

    if (invoicesResult.error) return serverError(invoicesResult.error.message)
    if (jobsResult.error) return serverError(jobsResult.error.message)
    if (expensesResult.error) return serverError(expensesResult.error.message)

    const invoices = invoicesResult.data ?? []
    const jobs = jobsResult.data ?? []
    const expenses = expensesResult.data ?? []

    const totalRevenue = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (i.paid_amount ?? i.total_amount), 0)

    const totalDeposits = invoices
      .filter((i) => i.status === 'deposit_paid')
      .reduce((sum, i) => sum + (i.deposit_amount ?? 0), 0)

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

    const revenueByStream = invoices
      .filter((i) => i.status === 'paid')
      .reduce<Record<string, number>>((acc, i) => {
        const stream = i.revenue_stream ?? 'unknown'
        acc[stream] = (acc[stream] ?? 0) + (i.paid_amount ?? i.total_amount)
        return acc
      }, {})

    const paymentByMethod = invoices
      .filter((i) => i.status === 'paid')
      .reduce<Record<string, number>>((acc, i) => {
        const method = i.payment_method ?? 'unknown'
        acc[method] = (acc[method] ?? 0) + (i.paid_amount ?? i.total_amount)
        return acc
      }, {})

    return Response.json({
      data: {
        date,
        invoices: {
          total: invoices.length,
          paid: invoices.filter((i) => i.status === 'paid').length,
          deposit_paid: invoices.filter((i) => i.status === 'deposit_paid').length,
          quote: invoices.filter((i) => i.status === 'quote').length,
        },
        revenue: {
          collected: totalRevenue,
          deposits: totalDeposits,
          net: totalRevenue - totalExpenses,
          by_stream: revenueByStream,
          by_payment_method: paymentByMethod,
        },
        expenses: {
          total: totalExpenses,
          count: expenses.length,
        },
        jobs: {
          new_today: jobs.length,
          by_bucket: jobs.reduce<Record<string, number>>((acc, j) => {
            acc[j.bucket] = (acc[j.bucket] ?? 0) + 1
            return acc
          }, {}),
        },
      },
    })
  }

  // ── AR Aging ───────────────────────────────────────────────────────────────
  if (type === 'ar_aging') {
    const today = new Date()
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, invoice_date, total_amount, status,
        customer:customers(id, full_name, phone)
      `)
      .in('status', ['quote', 'approved', 'deposit_paid', 'pending'])
      .order('invoice_date', { ascending: true })

    if (error) return serverError(error.message)

    const aged = (invoices ?? []).map((inv) => {
      const daysDue = Math.floor(
        (today.getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      let bucket: string
      if (daysDue <= 0) bucket = 'current'
      else if (daysDue <= 30) bucket = '1_30'
      else if (daysDue <= 60) bucket = '31_60'
      else if (daysDue <= 90) bucket = '61_90'
      else bucket = '90_plus'

      return { ...inv, days_due: daysDue, aging_bucket: bucket }
    })

    const summary = aged.reduce<Record<string, { count: number; amount: number }>>((acc, inv) => {
      if (!acc[inv.aging_bucket]) acc[inv.aging_bucket] = { count: 0, amount: 0 }
      acc[inv.aging_bucket].count++
      acc[inv.aging_bucket].amount += inv.total_amount
      return acc
    }, {})

    return Response.json({ data: { invoices: aged, summary } })
  }

  // ── Revenue summary ────────────────────────────────────────────────────────
  if (type === 'revenue') {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('revenue_stream, total_amount, paid_amount, status, invoice_date')
      .gte('invoice_date', from)
      .lte('invoice_date', to)
      .neq('status', 'void')

    if (error) return serverError(error.message)

    const byStream = (invoices ?? []).reduce<Record<string, { invoiced: number; collected: number; count: number }>>((acc, inv) => {
      const stream = inv.revenue_stream ?? 'unknown'
      if (!acc[stream]) acc[stream] = { invoiced: 0, collected: 0, count: 0 }
      acc[stream].invoiced += inv.total_amount
      acc[stream].collected += inv.status === 'paid' ? (inv.paid_amount ?? inv.total_amount) : 0
      acc[stream].count++
      return acc
    }, {})

    const totals = {
      invoiced: (invoices ?? []).reduce((s, i) => s + i.total_amount, 0),
      collected: (invoices ?? [])
        .filter((i) => i.status === 'paid')
        .reduce((s, i) => s + (i.paid_amount ?? i.total_amount), 0),
    }

    return Response.json({ data: { from, to, by_stream: byStream, totals } })
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  if (type === 'csv_invoices') {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, invoice_date, status, revenue_stream,
        total_amount, deposit_amount, deposit_paid_at,
        paid_amount, payment_method, paid_at, notes,
        customer:customers(full_name, phone),
        vehicle:vehicles(make, model, year, license_plate),
        job:jobs(description)
      `)
      .gte('invoice_date', from)
      .lte('invoice_date', to)
      .order('invoice_date', { ascending: true })

    if (error) return serverError(error.message)

    const rows = (invoices ?? []).map((inv) => {
      const c = inv.customer as { full_name?: string; phone?: string } | null
      const v = inv.vehicle as { make?: string; model?: string; year?: number; license_plate?: string } | null
      const j = inv.job as { description?: string } | null

      const cols = [
        inv.invoice_number ?? inv.id,
        inv.invoice_date,
        inv.status,
        inv.revenue_stream,
        c?.full_name ?? '',
        c?.phone ?? '',
        v ? `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim() : '',
        v?.license_plate ?? '',
        inv.total_amount,
        inv.deposit_amount ?? '',
        inv.deposit_paid_at ?? '',
        inv.paid_amount ?? '',
        inv.payment_method ?? '',
        inv.paid_at ?? '',
        (j?.description ?? '').replace(/\n/g, ' ').substring(0, 200),
        inv.notes ?? '',
      ]

      return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
    })

    const header = [
      'Invoice #', 'Date', 'Status', 'Revenue Stream',
      'Customer', 'Phone', 'Vehicle', 'Plate',
      'Total (THB)', 'Deposit (THB)', 'Deposit Paid At',
      'Paid (THB)', 'Payment Method', 'Paid At',
      'Job Description', 'Notes',
    ].map((h) => `"${h}"`).join(',')

    const csv = [header, ...rows].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoices_${from}_${to}.csv"`,
      },
    })
  }

  return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Unknown report type' } }, { status: 400 })
}
