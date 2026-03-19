import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, notFoundError, serverError } from '@/lib/utils/validation'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { InvoicePDF } from '@/components/pdf/InvoicePDF'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, status, revenue_stream,
      total_amount, deposit_amount, deposit_paid_at, paid_amount, payment_method, paid_at, notes,
      customer:customers(full_name, phone, line_id, email),
      vehicle:vehicles(make, model, year, license_plate),
      job:jobs(
        id, description,
        line_items:job_line_items(description, quantity, sale_price, line_type, sku)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !invoice) return notFoundError('Invoice')

  try {
    const buffer = await renderToBuffer(createElement(InvoicePDF, { invoice: invoice as never }))

    const filename = `invoice_${invoice.invoice_number ?? id.slice(0, 8)}.pdf`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'PDF generation failed')
  }
}
