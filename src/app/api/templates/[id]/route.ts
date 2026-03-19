import { createClient } from '@/lib/supabase/server'
import {
  UpdateTemplateSchema,
  TemplateItemSchema,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { data, error } = await supabase
    .from('job_templates')
    .select('*, items:job_template_items(*, product:products(id, sku, name, sale_price, unit))')
    .eq('id', id)
    .single()

  if (error || !data) return notFoundError('Template')
  return Response.json({ data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
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

  const PatchSchema = UpdateTemplateSchema.extend({
    items: z.array(TemplateItemSchema).optional(),
  })

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { items, ...templateData } = parsed.data

  if (Object.keys(templateData).length > 0) {
    const { error } = await supabase
      .from('job_templates')
      .update(templateData)
      .eq('id', id)

    if (error) return serverError(error.message)
  }

  // Replace all items if provided
  if (items !== undefined) {
    await supabase.from('job_template_items').delete().eq('template_id', id)

    if (items.length > 0) {
      const itemRows = items.map((item, i) => ({
        ...item,
        template_id: id,
        sort_order: item.sort_order ?? i,
      }))
      const { error } = await supabase.from('job_template_items').insert(itemRows)
      if (error) return serverError(error.message)
    }
  }

  const { data: full, error: fetchError } = await supabase
    .from('job_templates')
    .select('*, items:job_template_items(*, product:products(id, sku, name, sale_price, unit))')
    .eq('id', id)
    .single()

  if (fetchError || !full) return notFoundError('Template')
  return Response.json({ data: full })
}
