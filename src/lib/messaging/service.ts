/**
 * Unified messaging service
 *
 * All outbound LINE messages go through here so that:
 * 1. Consent is verified (consent_to_message = true AND line_id present)
 * 2. Rate limiting is respected (max 3 automated messages per job)
 * 3. Messages are logged to message_log
 * 4. AI translation via Claude is available for PA ↔ customer messages
 * 5. Demo mode suppresses actual sends
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { pushMessage, isDemoMode } from '@/lib/line/client'
import type { LineMessage } from '@/lib/line/client'

// ── AI Translation ────────────────────────────────────────────────────────────

/**
 * Translate text using Claude. Used for PA ↔ customer messaging.
 * Returns the translated text, or the original if translation fails.
 */
export async function translateText(
  text: string,
  targetLanguage: 'th' | 'en'
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[messaging] ANTHROPIC_API_KEY not set — skipping translation')
    return text
  }

  try {
    const client = new Anthropic({ apiKey })
    const langLabel = targetLanguage === 'th' ? 'Thai' : 'English'

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Translate the following message to ${langLabel}. Return ONLY the translated text — no explanations, no quotes, no labels.\n\n${text}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type === 'text') return content.text.trim()
    return text
  } catch (err) {
    console.error('[messaging] translation error', err)
    return text
  }
}

/**
 * Build a bilingual message from a single-language input.
 * PA types in any language → both Thai and English versions generated.
 *
 * Returns a formatted bilingual string:
 *   🔧 Butler Garage
 *
 *   [Thai]
 *
 *   [English]
 *
 *   —
 *   Butler Garage | Bangkok
 */
export async function buildBilingualMessage(
  originalText: string,
  originalLanguage: 'th' | 'en'
): Promise<string> {
  let thai: string
  let english: string

  if (originalLanguage === 'th') {
    thai = originalText
    english = await translateText(originalText, 'en')
  } else {
    english = originalText
    thai = await translateText(originalText, 'th')
  }

  return [
    '🔧 Butler Garage',
    '',
    thai,
    '',
    english,
    '',
    '—',
    'Butler Garage | Bangkok',
  ].join('\n')
}

// ── Core send function ────────────────────────────────────────────────────────

interface SendOptions {
  customerId: string
  jobId?: string
  messageType: string
  messages: LineMessage[]
  /** Skip consent + rate-limit checks (for scope change flex messages where customer already engaged) */
  skipChecks?: boolean
}

interface SendResult {
  ok: boolean
  skipped?: 'no_line_id' | 'no_consent' | 'rate_limit'
  error?: string
  demo?: boolean
}

export async function sendLineMessage(opts: SendOptions): Promise<SendResult> {
  const supabase = await createClient()

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

  if (!opts.skipChecks && !customer.consent_to_message) {
    console.log(`[messaging] customer ${opts.customerId} has not consented — skipping`)
    return { ok: true, skipped: 'no_consent' }
  }

  // ── 2. Rate limit: max 3 automated messages per job ────────────────────────
  if (!opts.skipChecks && opts.jobId) {
    const { count } = await supabase
      .from('message_log')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', opts.jobId)
      .eq('channel', 'line')

    if ((count ?? 0) >= 3) {
      console.warn(`[messaging] rate limit reached for job ${opts.jobId}`)
      return { ok: true, skipped: 'rate_limit' }
    }
  }

  // ── 3. Send ─────────────────────────────────────────────────────────────────
  const messageContent = opts.messages
    .map((m) => (m.type === 'text' ? m.text : `[Flex: ${m.altText}]`))
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

  return { ok: true, demo: isDemoMode() }
}

// ── PA → Customer direct message (with AI translation) ───────────────────────

interface DirectMessageOptions {
  customerId: string
  jobId?: string
  text: string
  /** Language the PA typed in — will be auto-translated to the other language */
  senderLanguage: 'th' | 'en'
}

export async function sendDirectMessage(opts: DirectMessageOptions): Promise<SendResult> {
  const bilingual = await buildBilingualMessage(opts.text, opts.senderLanguage)

  return sendLineMessage({
    customerId: opts.customerId,
    jobId: opts.jobId,
    messageType: 'direct_message',
    messages: [{ type: 'text', text: bilingual }],
    skipChecks: false,
  })
}
