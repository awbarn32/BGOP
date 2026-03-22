import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

const ClockInSchema = z.object({
  job_id: z.string().uuid(),
})

const ClockOutSchema = z.object({
  log_id: z.string().uuid(),
  reason: z.enum(['completed', 'awaiting_parts', 'awaiting_approval', 'break']),
})

// GET /api/mechanic/time-logs — returns the mechanic's open (clocked-in) session
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  const { data, error } = await supabase
    .from('mechanic_time_logs')
    .select('id, job_id, clocked_in_at, reason')
    .eq('mechanic_id', user.id)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return serverError(error.message)
  return Response.json({ data })
}

// POST /api/mechanic/time-logs — clock in
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try { body = await req.json() } catch { return validationError('Invalid JSON') }

  const parsed = ClockInSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  // Close any open session first
  await supabase
    .from('mechanic_time_logs')
    .update({ clocked_out_at: new Date().toISOString(), reason: 'break' })
    .eq('mechanic_id', user.id)
    .is('clocked_out_at', null)

  const { data, error } = await supabase
    .from('mechanic_time_logs')
    .insert({
      job_id: parsed.data.job_id,
      mechanic_id: user.id,
      reason: 'working',
    })
    .select('id, job_id, clocked_in_at')
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data }, { status: 201 })
}

// PATCH /api/mechanic/time-logs — clock out
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['mechanic', 'owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try { body = await req.json() } catch { return validationError('Invalid JSON') }

  const parsed = ClockOutSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { data, error } = await supabase
    .from('mechanic_time_logs')
    .update({
      clocked_out_at: new Date().toISOString(),
      reason: parsed.data.reason,
    })
    .eq('id', parsed.data.log_id)
    .eq('mechanic_id', user.id)
    .is('clocked_out_at', null)
    .select('id, job_id, clocked_in_at, clocked_out_at, reason')
    .single()

  if (error) return serverError(error.message)
  if (!data) return Response.json({ error: { code: 'NOT_FOUND', message: 'Open session not found' } }, { status: 404 })
  return Response.json({ data })
}
