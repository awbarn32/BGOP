import { createClient, getSessionUser } from '@/lib/supabase/server'
import {
  CreateTemplateSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return unauthorizedError()

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') !== 'false'

  let query = supabase
    .from('job_templates')
    .select(`
      *,
      items:job_template_items(
        *,
        product:products(id, sku, name, sale_price, unit)
      )
    `)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return Response.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { items, ...templateData } = parsed.data

  // Insert template
  const { data: template, error: templateError } = await supabase
    .from('job_templates')
    .insert(templateData)
    .select()
    .single()

  if (templateError) return serverError(templateError.message)

  // Insert items if any
  if (items.length > 0) {
    const itemRows = items.map((item, i) => ({
      ...item,
      template_id: template.id,
      sort_order: item.sort_order ?? i,
    }))

    const { error: itemsError } = await supabase
      .from('job_template_items')
      .insert(itemRows)

    if (itemsError) return serverError(itemsError.message)
  }

  // Fetch full template with items
  const { data: full } = await supabase
    .from('job_templates')
    .select('*, items:job_template_items(*, product:products(id, sku, name, sale_price, unit))')
    .eq('id', template.id)
    .single()

  return Response.json({ data: full }, { status: 201 })
}
