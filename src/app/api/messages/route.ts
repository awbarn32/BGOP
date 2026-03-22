/**
 * GET  /api/messages           — inbox thread list
 * POST /api/messages           — send message to a customer (finds their most recent active job)
 *
 * GET query params:
 *   customer_id  — filter to a single customer thread
 *   limit        — default 200
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, validationError, serverError } from '@/lib/utils/validation'
import { sendDirectMessage } from '@/lib/messaging/service'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role === 'mechanic' || role === 'driver') return forbiddenError()

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customer_id')
  const limit = Math.min(Number(searchParams.get('limit') ?? '200'), 500)

  let query = supabase
    .from('message_log')
    .select(`
      id,
      job_id,
      customer_id,
      channel,
      message_type,
      content,
      sent_at,
      status,
      customer:customers(id, full_name, phone, line_id)
    `)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: { message: error.message } }, { status: 500 })
  }

  return Response.json({ data: data ?? [] })
}

// ── POST — send a message to a customer ──────────────────────────────────────

const SendSchema = z.object({
  customer_id: z.string().uuid(),
  text: z.string().min(1).max(2000),
  sender_language: z.enum(['th', 'en']).default('en'),
  recipient_language: z.enum(['th', 'en']).default('th'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role === 'mechanic' || role === 'driver') return forbiddenError()

  let body: unknown
  try { body = await request.json() } catch { return validationError('Invalid JSON') }

  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { customer_id, text, sender_language, recipient_language } = parsed.data

  // Find most recent active job for this customer
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customer_id)
    .not('status', 'in', '("completed","cancelled")')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fall back to most recent job of any status if no active job
  const jobId = job?.id ?? (await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customer_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  ).data?.id ?? undefined

  const result = await sendDirectMessage({
    customerId: customer_id,
    jobId,
    text,
    senderLanguage: sender_language,
    recipientLanguage: recipient_language,
    sentByUserId: user.id,
  })

  if (!result.ok) return serverError(result.error ?? 'Failed to send message')

  if (result.skipped) {
    const reason =
      result.skipped === 'no_line_id' ? 'Customer has no LINE ID on file' :
      result.skipped === 'no_consent' ? 'Customer has not consented to receive messages' :
      'Message rate limit reached'
    return Response.json({ ok: false, skipped: true, reason })
  }

  return Response.json({ ok: true, demo: result.demo ?? false })
}
