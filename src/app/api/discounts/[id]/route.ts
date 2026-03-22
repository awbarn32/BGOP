import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const UpdateDiscountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  discount_type: z.enum(['percent', 'fixed']).optional(),
  discount_value: z.number().positive().optional(),
  applicable_to: z.enum(['all', 'labour', 'parts', 'service_package', 'specific_streams']).optional(),
  applicable_streams: z.array(z.enum([
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel',
  ])).nullable().optional(),
  min_invoice_amount: z.number().nonnegative().nullable().optional(),
  max_discount_amount: z.number().nonnegative().nullable().optional(),
  preapproved: z.boolean().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner') return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = UpdateDiscountSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Extra validation: if percent type and value given, must be 0-100
  if (
    parsed.data.discount_type === 'percent' &&
    parsed.data.discount_value != null &&
    parsed.data.discount_value > 100
  ) {
    return validationError('Percentage discount value must be between 0 and 100')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('discounts')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Discount')
  return Response.json({ data })
}

// Soft delete — sets active = false
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner') return forbiddenError()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('discounts')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Discount')
  return Response.json({ data })
}
