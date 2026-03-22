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

import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushMessage, isDemoMode } from '@/lib/line/client'
import type { LineMessage } from '@/lib/line/client'

// ── Language helpers (F7) ─────────────────────────────────────────────────────

/**
 * F7 — Selects the delivery language based on customer preference.
 * 'th' → Thai only, 'en' → English only, null/undefined → bilingual
 */
export function selectLanguage(preferredLanguage: string | null | undefined): 'th' | 'en' | 'bilingual' {
  if (preferredLanguage === 'th') return 'th'
  if (preferredLanguage === 'en') return 'en'
  return 'bilingual'
}

/**
 * Parses a bilingual string 'Thai / English' and returns the appropriate variant.
 */
export function parseBilingual(text: string, lang: 'th' | 'en' | 'bilingual'): string {
  if (!text.includes(' / ')) return text
  const [thai, english] = text.split(' / ', 2)
  if (lang === 'th') return thai
  if (lang === 'en') return english
  return text // bilingual — keep full string
}

// ── AI Translation ────────────────────────────────────────────────────────────

/**
 * Translate text using Claude. Used for PA ↔ customer messaging.
 * Returns the translated text, or the original if translation fails.
 */
export async function translateText(
  text: string,
  targetLanguage: 'th' | 'en'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[messaging] OPENAI_API_KEY not set — skipping translation')
    return text
  }

  try {
    const client = new OpenAI({ apiKey })
    const langLabel = targetLanguage === 'th' ? 'Thai' : 'English'

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Translate the following message to ${langLabel}. Return ONLY the translated text — no explanations, no quotes, no labels.\n\n${text}`,
        },
      ],
    })

    const translated = response.choices[0]?.message?.content?.trim()
    return translated ?? text
  } catch (err) {
    console.error('[messaging] translation error', err)
    return text
  }
}

/**
 * Build a translated message targeting a single language.
 *
 * Returns a formatted string:
 *   🔧 Butler Garage
 *
 *   [Translated Text]
 *
 *   —
 *   Butler Garage | Bangkok
 */
export async function buildTranslatedMessage(
  originalText: string,
  originalLanguage: 'th' | 'en',
  recipientLanguage: 'th' | 'en'
): Promise<string> {
  if (originalLanguage === recipientLanguage) {
    return originalText
  }
  return await translateText(originalText, recipientLanguage)
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

  return { ok: true, demo: isDemoMode() }
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
}

export async function sendDirectMessage(opts: DirectMessageOptions): Promise<SendResult> {
  const translated = await buildTranslatedMessage(opts.text, opts.senderLanguage, opts.recipientLanguage)

  return sendLineMessage({
    customerId: opts.customerId,
    jobId: opts.jobId,
    messageType: 'direct_message',
    messages: [{ type: 'text', text: translated }],
    skipChecks: false,
  })
}
