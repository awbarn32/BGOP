import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const CreateScopeChangeSchema = z.object({
  description: z.string().min(1).max(2000),
  amount_thb: z.number().nonnegative(),
  mechanic_notes: z.string().max(2000).nullable().optional(),
})

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const { data, error } = await supabase
    .from('scope_changes')
    .select('*')
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  if (error) return serverError(error.message)
  return Response.json({ data })
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = CreateScopeChangeSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('scope_changes')
    .insert({
      job_id: id,
      flagged_by: user.id,
      entered_by: user.id,
      description: parsed.data.description,
      amount_thb: parsed.data.amount_thb,
      mechanic_notes: parsed.data.mechanic_notes ?? null,
      status: 'flagged',
    })
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}
