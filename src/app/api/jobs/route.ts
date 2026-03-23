import { createClient } from '@/lib/supabase/server'
import {
  CreateJobSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

// Kanban-optimised SELECT — only the fields cards need
const CARD_SELECT = `
  id, bucket, status, priority, description,
  revenue_stream, logistics_type, mechanic_id,
  owner_notify_threshold_thb, created_at, updated_at,
  customer:customers(id, full_name, phone, line_id),
  vehicle:vehicles(id, make, model, year, license_plate),
  mechanic:users(id, full_name),
  scope_changes(id, status)
`

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get('bucket') ?? ''
  const archived = searchParams.get('archived') === 'true'

  let query = supabase
    .from('jobs')
    .select(CARD_SELECT)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (archived) {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
  }

  if (bucket) {
    query = query.eq('bucket', bucket)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateJobSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { template_id, ...jobData } = parsed.data

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...jobData, template_id: template_id ?? null })
    .select(CARD_SELECT)
    .single()

  if (error) return serverError(error.message)

  // If a template was selected, copy its line items into the new job
  let invoiceTotal = 0
  if (template_id && data) {
    const { data: templateItems } = await supabase
      .from('job_template_items')
      .select('line_type, description, quantity, sort_order, product:products(id, sku, sale_price, cost_price)')
      .eq('template_id', template_id)
      .order('sort_order')

    if (templateItems && templateItems.length > 0) {
      const lineItems = templateItems.map((item) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product
        const salePrice = (product as { sale_price?: number } | null)?.sale_price ?? 0
        invoiceTotal += salePrice * item.quantity
        return {
          job_id: data.id,
          line_type: item.line_type,
          description: item.description,
          quantity: item.quantity,
          sale_price: salePrice,
          cost_price: (product as { cost_price?: number | null } | null)?.cost_price ?? null,
          sku: (product as { sku?: string } | null)?.sku ?? null,
          product_id: (product as { id?: string } | null)?.id ?? null,
          sort_order: item.sort_order,
          cost_estimated: !(product as { cost_price?: number | null } | null)?.cost_price,
        }
      })
      await supabase.from('job_line_items').insert(lineItems)
    }
  }

  // Auto-create a quote invoice for every new job
  if (data) {
    await supabase.from('invoices').insert({
      job_id: data.id,
      customer_id: jobData.customer_id,
      vehicle_id: jobData.vehicle_id,
      revenue_stream: jobData.revenue_stream ?? 'service',
      invoice_date: new Date().toISOString().slice(0, 10),
      status: 'quote',
      total_amount: invoiceTotal,
    })
  }

  return Response.json({ data }, { status: 201 })
}
