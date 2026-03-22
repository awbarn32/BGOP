/**
 * Unified messaging service
 *
 * All outbound LINE messages go through here so that:
 * 1. Consent is verified (consent_to_message = true AND line_id present)
 * 2. Rate limiting is respected (max 3 automated messages per job)
 * 3. Messages are logged to message_log
 * 4. AI translation via GPT-5 mini is available for PA ↔ customer messages
 * 5. Demo mode suppresses actual sends
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { pushMessage, isDemoMode } from '@/lib/line/client'
import { recordConversationMessage } from '@/lib/messaging/conversations'
import { persistMessageLocalization } from '@/lib/messaging/ai'
import { isLocalizationReady } from '@/lib/messaging/localization'
import type { LineMessage } from '@/lib/line/client'

// ── Core send function ────────────────────────────────────────────────────────

interface SendOptions {
  customerId: string
  jobId?: string
  messageType: string
  messages: LineMessage[]
  senderRole?: 'owner' | 'pa' | 'bot'
  sentByUserId?: string
  /** Skip consent + rate-limit checks (for scope change flex messages where customer already engaged) */
  skipChecks?: boolean
}

interface SendResult {
  ok: boolean
  skipped?: 'no_line_id' | 'no_consent' | 'rate_limit'
  error?: string
  demo?: boolean
  threadId?: string
  messageId?: string
}

export async function sendLineMessage(opts: SendOptions): Promise<SendResult> {
  const supabase = createAdminClient()

  // ── 1. Fetch customer consent + LINE ID ────────────────────────────────────
  const { data: customer } = await supabase
    .from('customers')
    .select('line_id, consent_to_message')
    .eq('id', opts.customerId)
    .single()

  if (!customer?.line_id) {
    console.log(`[messaging] customer ${opts.customerId} has no LINE ID — skipping`)
    return { ok: true, skipped: 'no_line_id' }
  }

  // Verify that the LINE ID is a valid Webhook-generated ID (starts with U, R, or C and is 33 chars long)
  // If a PA manually types a display name like "@joesmith", the LINE API will reject it.
  const validPrefixes = ['U', 'R', 'C']
  const isValidLineId = customer.line_id.length === 33 && validPrefixes.includes(customer.line_id[0])
  
  if (!isValidLineId) {
    console.log(`[messaging] customer ${opts.customerId} has invalid LINE ID format: ${customer.line_id}`)
    return { ok: false, error: 'Invalid LINE ID. The customer must send a message to the Garage LINE Bot first to link their account!' }
  }

  if (!opts.skipChecks && !customer.consent_to_message) {
    console.log(`[messaging] customer ${opts.customerId} has not consented — skipping`)
    return { ok: true, skipped: 'no_consent' }
  }

  // ── 2. Rate limit: max 3 automated messages per job (PA direct messages exempt) ──
  if (!opts.skipChecks && opts.jobId && opts.messageType !== 'direct_message') {
    const { count } = await supabase
      .from('message_log')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', opts.jobId)
      .eq('channel', 'line')
      .neq('message_type', 'direct_message')

    if ((count ?? 0) >= 3) {
      console.warn(`[messaging] rate limit reached for job ${opts.jobId}`)
      return { ok: true, skipped: 'rate_limit' }
    }
  }

  // ── 3. Send ─────────────────────────────────────────────────────────────────
  const messageContent = opts.messages
    .map((m) => {
      if (m.type === 'text') return m.text
      if (m.type === 'image') return '[Photo]'
      return `[Flex: ${m.altText}]`
    })
    .join(' | ')

  const result = await pushMessage(customer.line_id, opts.messages)

  // ── 4. Log to message_log ─────────────────────────────────────────────────
  await supabase.from('message_log').insert({
    customer_id: opts.customerId,
    job_id: opts.jobId ?? null,
    channel: 'line',
    message_type: opts.messageType,
    content: messageContent,
    status: result.ok ? 'sent' : 'failed',
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const recorded = await recordConversationMessage({
    lineUserId: customer.line_id,
    customerId: opts.customerId,
    direction: 'outbound',
    senderRole: opts.senderRole ?? 'pa',
    messageType: opts.messageType,
    bodyText: messageContent,
    activeJobId: opts.jobId ?? null,
    sentByUserId: opts.sentByUserId,
    skipAuditLog: true,
  }).catch((err) => {
    console.warn('[messaging] conversation record failed', err)
    return null
  })

  return {
    ok: true,
    demo: isDemoMode(),
    threadId: recorded?.threadId,
    messageId: recorded?.messageId,
  }
}

// ── PA → Customer direct message (with AI translation) ───────────────────────

interface DirectMessageOptions {
  customerId: string
  jobId?: string
  text: string
  /** Language the PA typed in */
  senderLanguage: 'th' | 'en'
  /** Language the customer will receive the message in */
  recipientLanguage: 'th' | 'en'
  sentByUserId?: string
}

export async function sendDirectMessage(opts: DirectMessageOptions): Promise<SendResult> {
  const supabase = createAdminClient()
  const { data: thread } = await supabase
    .from('conversation_threads')
    .select('id')
    .eq('customer_id', opts.customerId)
    .order('latest_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let contextMessages:
    | Array<{
        id: string
        direction: 'inbound' | 'outbound' | 'system'
        sender_role: string | null
        message_type: string | null
        body_text: string | null
        sent_at: string
      }>
    | undefined

  if (thread?.id) {
    const { data: recentMessages } = await supabase
      .from('conversation_messages')
      .select('id, direction, sender_role, message_type, body_text, sent_at')
      .eq('thread_id', thread.id)
      .order('sent_at', { ascending: false })
      .limit(6)

    contextMessages = (recentMessages ?? []).reverse()
  }

  const localization = await persistMessageLocalization({
    threadId: thread?.id ?? null,
    originalText: opts.text,
    originalLanguage: opts.senderLanguage,
    counterpartLanguage: opts.recipientLanguage,
    contextMessages,
  })

  const textForCustomer =
    opts.recipientLanguage === 'th'
      ? localization?.text_th ?? opts.text
      : localization?.text_en ?? opts.text

  if (opts.senderLanguage !== opts.recipientLanguage && !isLocalizationReady(localization ?? null)) {
    return {
      ok: false,
      error: `Translation unavailable. Add a valid OPENAI_API_KEY or send the message in ${opts.recipientLanguage.toUpperCase()} manually.`,
    }
  }

  const result = await sendLineMessage({
    customerId: opts.customerId,
    jobId: opts.jobId,
    messageType: 'direct_message',
    messages: [{ type: 'text', text: textForCustomer }],
    senderRole: 'pa',
    sentByUserId: opts.sentByUserId,
    skipChecks: false,
  })

  if (!result.ok || !result.messageId || !result.threadId) {
    return result
  }

  await persistMessageLocalization({
    threadId: result.threadId,
    messageId: result.messageId,
    originalText: opts.text,
    originalLanguage: opts.senderLanguage,
    counterpartLanguage: opts.recipientLanguage,
    localization: localization ?? undefined,
  })

  return result
}
