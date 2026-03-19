/**
 * POST /api/jobs/[id]/send-message
 *
 * PA sends a direct message to the job's customer via LINE.
 * Claude AI auto-translates to produce a bilingual message.
 *
 * Body: { text: string, sender_language: 'th' | 'en' }
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendDirectMessage } from '@/lib/messaging/service'
import {
  unauthorizedError,
  forbiddenError,
  notFoundError,
  validationError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const SendMessageSchema = z.object({
  text: z.string().min(1).max(2000),
  sender_language: z.enum(['th', 'en']).default('en'),
})

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role as string
  if (role === 'mechanic' || role === 'driver') return forbiddenError()

  // Fetch job + customer
  const { data: job } = await supabase
    .from('jobs')
    .select('id, customer_id, customer:customers(id, full_name, line_id, consent_to_message)')
    .eq('id', id)
    .single()

  if (!job) return notFoundError('Job')

  let body: unknown
  try { body = await request.json() } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = SendMessageSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const { text, sender_language } = parsed.data

  const result = await sendDirectMessage({
    customerId: job.customer_id,
    jobId: id,
    text,
    senderLanguage: sender_language,
  })

  if (!result.ok) {
    return serverError(result.error ?? 'Failed to send message')
  }

  if (result.skipped) {
    const reason =
      result.skipped === 'no_line_id'
        ? 'Customer does not have a LINE ID on file'
        : result.skipped === 'no_consent'
        ? 'Customer has not consented to receive messages'
        : 'Message rate limit reached for this job'
    return Response.json({ ok: false, skipped: true, reason })
  }

  return Response.json({ ok: true, demo: result.demo ?? false })
}
