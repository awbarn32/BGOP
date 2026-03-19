/**
 * POST /api/webhooks/line
 *
 * Receives events from LINE Messaging API.
 * Handles:
 *   - Postback: scope_approve:{id} / scope_decline:{id}
 *   - Message: logs inbound customer messages (Phase 2: PA inbox)
 *
 * LINE requires a 200 response within 10s regardless of processing outcome.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLineSignature } from '@/lib/line/client'
import { sendLineMessage } from '@/lib/messaging/service'
import * as T from '@/lib/line/templates'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  // Verify signature in production
  if (process.env.LINE_CHANNEL_SECRET) {
    if (!verifyLineSignature(rawBody, signature)) {
      console.warn('[LINE webhook] invalid signature')
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: { events?: LineEvent[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process events in background — return 200 immediately
  processEvents(payload.events ?? []).catch((err) =>
    console.error('[LINE webhook] processing error', err)
  )

  return Response.json({ status: 'ok' })
}

// ── Types ────────────────────────────────────────────────────────────────────

interface LineEvent {
  type: string
  source?: { userId?: string }
  postback?: { data: string }
  message?: { type: string; text?: string }
  replyToken?: string
}

// ── Event processor ──────────────────────────────────────────────────────────

async function processEvents(events: LineEvent[]) {
  for (const event of events) {
    try {
      if (event.type === 'postback' && event.postback?.data) {
        await handlePostback(event.postback.data, event.source?.userId)
      } else if (event.type === 'message' && event.message?.type === 'text') {
        await handleTextMessage(event.source?.userId, event.message.text)
      }
    } catch (err) {
      console.error('[LINE webhook] event error', err)
    }
  }
}

// ── Scope change approval/decline ────────────────────────────────────────────

async function handlePostback(data: string, _lineUserId?: string) {
  if (!data.startsWith('scope_approve:') && !data.startsWith('scope_decline:')) {
    console.log('[LINE webhook] unhandled postback:', data)
    return
  }

  const [action, scopeId] = data.split(':')
  const approved = action === 'scope_approve'

  const supabase = createAdminClient()

  // Fetch scope change
  const { data: scope } = await supabase
    .from('scope_changes')
    .select(`
      id, job_id, status, description, amount_thb,
      job:jobs(
        id, customer_id, mechanic_id,
        customer:customers(id, full_name, consent_to_message, line_id)
      )
    `)
    .eq('id', scopeId)
    .single()

  if (!scope || scope.status !== 'pending') {
    console.warn('[LINE webhook] scope change not found or not pending:', scopeId)
    return
  }

  const job = scope.job as unknown as {
    id: string; customer_id: string; mechanic_id: string | null
    customer: { id: string; full_name: string; consent_to_message: boolean; line_id: string | null }
  } | null

  if (!job) return

  const customerName = job.customer.full_name

  if (approved) {
    // Update scope change status
    await supabase
      .from('scope_changes')
      .update({ status: 'approved', customer_response_at: new Date().toISOString() })
      .eq('id', scopeId)

    // Send confirmation to customer
    await sendLineMessage({
      customerId: job.customer_id,
      jobId: job.id,
      messageType: 'scope_approved',
      messages: [T.scopeChangeApproved(customerName)],
      skipChecks: true, // customer already engaged via LINE
    })

    console.log('[LINE webhook] scope change approved:', scopeId)
  } else {
    // Update scope change status
    await supabase
      .from('scope_changes')
      .update({ status: 'declined', customer_response_at: new Date().toISOString() })
      .eq('id', scopeId)

    // Notify customer
    await sendLineMessage({
      customerId: job.customer_id,
      jobId: job.id,
      messageType: 'scope_declined',
      messages: [T.scopeChangeDeclined(customerName)],
      skipChecks: true,
    })

    console.log('[LINE webhook] scope change declined:', scopeId)
  }
}

// ── Inbound text message (log for PA inbox — Phase 2 UI) ─────────────────────

async function handleTextMessage(lineUserId?: string, text?: string) {
  if (!lineUserId || !text) return

  const supabase = createAdminClient()

  // Find customer by LINE user ID
  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('line_id', lineUserId)
    .single()

  if (!customer) {
    console.log('[LINE webhook] inbound message from unknown LINE user:', lineUserId)
    return
  }

  // Log inbound message
  await supabase.from('message_log').insert({
    customer_id: customer.id,
    channel: 'line',
    message_type: 'inbound',
    content: text,
    status: 'delivered',
  })

  console.log('[LINE webhook] inbound message logged from', customer.full_name)
}
