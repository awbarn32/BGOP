import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

const CreateDiscountSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().positive(),
  applicable_to: z.enum(['all', 'labour', 'parts', 'service_package', 'specific_streams']),
  applicable_streams: z.array(z.enum([
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel',
  ])).nullable().optional(),
  min_invoice_amount: z.number().nonnegative().nullable().optional(),
  max_discount_amount: z.number().nonnegative().nullable().optional(),
  preapproved: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  const { searchParams } = new URL(request.url)
  const activeParam = searchParams.get('active')

  let query = supabase
    .from('discounts')
    .select('*')
    .order('preapproved', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (activeParam === 'true') {
    query = query.eq('active', true)
  } else if (activeParam === 'false') {
    query = query.eq('active', false)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)

  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request) {
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

  const parsed = CreateDiscountSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Extra validation: percent must be 0-100
  if (parsed.data.discount_type === 'percent' && parsed.data.discount_value > 100) {
    return validationError('Percentage discount value must be between 0 and 100')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('discounts')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
