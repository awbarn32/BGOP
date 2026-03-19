/**
 * GET /api/messages
 *
 * Returns message_log entries joined with customer data,
 * ordered by sent_at desc. Used by the Messages inbox.
 *
 * Query params:
 *   customer_id  — filter to a single customer thread
 *   limit        — default 200
 */

import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError } from '@/lib/utils/validation'

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
