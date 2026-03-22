import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

export type Language = 'th' | 'en'

type Feature = 'translation' | 'summary' | 'reply_draft'

type CustomerContext = {
  customer: {
    id: string
    full_name: string
    preferred_language: Language
    line_display_name: string | null
    phone: string | null
    notes: string | null
  } | null
  vehicles: Array<{
    make: string
    model: string
    year: number
    license_plate: string | null
  }>
  recentJobs: Array<{
    status: string
    bucket: string
    description: string
    created_at: string
  }>
  outstandingInvoices: Array<{
    invoice_number: string | null
    status: string
    total_amount: number | null
    paid_amount: number | null
  }>
}

type TranscriptMessage = {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  sender_role: string | null
  message_type?: string | null
  body_text: string | null
  sent_at: string
  localization?: {
    source_language: 'th' | 'en' | 'unknown'
    text_en: string | null
    text_th: string | null
  } | null
}

type TranslationResult = {
  source_language: 'th' | 'en'
  text_th: string
  text_en: string
}

type SummaryResult = {
  summary: string
  open_questions: string[]
  commitments: string[]
  customer_preferences: string[]
  important_facts: string[]
  last_customer_intent: string
}

type ReplyDraftResult = {
  draft_th: string
  preview_for_customer: string
}

const MODEL = 'gpt-5-mini'
const PROMPT_VERSION = 'v1'
const SUMMARY_UNSUMMARIZED_THRESHOLD = 5
const TRANSLATION_INPUT_PRICE_PER_1M = 0.25
const TRANSLATION_CACHED_INPUT_PRICE_PER_1M = 0.025
const TRANSLATION_OUTPUT_PRICE_PER_1M = 2

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

function estimateCostUsd(usage?: {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { cached_tokens?: number }
}) {
  if (!usage) return 0
  const inputTokens = usage.input_tokens ?? 0
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
  const uncachedTokens = Math.max(0, inputTokens - cachedTokens)
  const outputTokens = usage.output_tokens ?? 0

  return Number(
    (
      (uncachedTokens / 1_000_000) * TRANSLATION_INPUT_PRICE_PER_1M +
      (cachedTokens / 1_000_000) * TRANSLATION_CACHED_INPUT_PRICE_PER_1M +
      (outputTokens / 1_000_000) * TRANSLATION_OUTPUT_PRICE_PER_1M
    ).toFixed(6)
  )
}

async function recordAiRun(args: {
  threadId?: string | null
  feature: Feature
  messageId?: string | null
  status: 'success' | 'error'
  usage?: {
    input_tokens?: number
    output_tokens?: number
    input_tokens_details?: { cached_tokens?: number }
    output_tokens_details?: { reasoning_tokens?: number }
  }
  errorMessage?: string
}) {
  const supabase = createAdminClient()
  const usage = args.usage
  await supabase.from('conversation_ai_runs').insert({
    thread_id: args.threadId ?? null,
    message_id: args.messageId ?? null,
    feature: args.feature,
    status: args.status,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    input_tokens: usage?.input_tokens ?? 0,
    cached_input_tokens: usage?.input_tokens_details?.cached_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    reasoning_tokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
    estimated_cost_usd: estimateCostUsd(usage),
    error_message: args.errorMessage ?? null,
  })
}

function buildContextBlock(context: CustomerContext) {
  return JSON.stringify(
    {
      customer: context.customer
        ? {
            full_name: context.customer.full_name,
            preferred_language: context.customer.preferred_language,
            line_display_name: context.customer.line_display_name,
            phone: context.customer.phone,
            notes: context.customer.notes,
          }
        : null,
      vehicles: context.vehicles.slice(0, 3),
      recent_jobs: context.recentJobs.slice(0, 3),
      outstanding_invoices: context.outstandingInvoices.slice(0, 3),
    },
    null,
    2
  )
}

function renderTranscript(messages: TranscriptMessage[]) {
  return messages
    .filter((message) => message.body_text)
    .map((message) => {
      const speaker =
        message.direction === 'inbound'
          ? 'customer'
          : message.sender_role === 'pa' || message.sender_role === 'owner'
          ? 'staff'
          : message.sender_role ?? message.direction
      return `[${message.sent_at}] ${speaker}: ${message.body_text}`
    })
    .join('\n')
}

async function jsonResponse<T>(args: {
  feature: Feature
  threadId?: string | null
  messageId?: string | null
  promptCacheKey: string
  instructions: string
  input: string
  schemaName: string
  schema: Record<string, unknown>
  maxOutputTokens: number
}): Promise<T | null> {
  const client = getClient()
  if (!client) return null

  try {
    const response = await client.responses.create({
      model: MODEL,
      store: false,
      temperature: 0.2,
      prompt_cache_key: args.promptCacheKey,
      instructions: args.instructions,
      input: args.input,
      max_output_tokens: args.maxOutputTokens,
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: args.schemaName,
          strict: true,
          schema: args.schema,
        },
      },
    })

    await recordAiRun({
      threadId: args.threadId,
      feature: args.feature,
      messageId: args.messageId ?? null,
      status: 'success',
      usage: response.usage,
    })

    return JSON.parse(response.output_text) as T
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI error'
    console.error('[messaging-ai] request failed', message)
    await recordAiRun({
      threadId: args.threadId,
      feature: args.feature,
      messageId: args.messageId ?? null,
      status: 'error',
      errorMessage: message,
    })
    return null
  }
}

async function fetchThreadContext(threadId: string): Promise<CustomerContext> {
  const supabase = createAdminClient()

  const { data: thread } = await supabase
    .from('conversation_threads')
    .select('customer_id')
    .eq('id', threadId)
    .single()

  if (!thread?.customer_id) {
    return {
      customer: null,
      vehicles: [],
      recentJobs: [],
      outstandingInvoices: [],
    }
  }

  const customerId = thread.customer_id

  const [
    { data: customer },
    { data: vehicles },
    { data: jobs },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name, preferred_language, line_display_name, phone, notes')
      .eq('id', customerId)
      .single(),
    supabase
      .from('vehicles')
      .select('make, model, year, license_plate')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('jobs')
      .select('status, bucket, description, created_at')
      .eq('customer_id', customerId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('invoices')
      .select('invoice_number, status, total_amount, paid_amount')
      .eq('customer_id', customerId)
      .in('status', ['quote', 'approved', 'deposit_paid', 'pending'])
      .order('invoice_date', { ascending: false })
      .limit(3),
  ])

  return {
    customer: (customer as CustomerContext['customer']) ?? null,
    vehicles: (vehicles as CustomerContext['vehicles']) ?? [],
    recentJobs: (jobs as CustomerContext['recentJobs']) ?? [],
    outstandingInvoices: (invoices as CustomerContext['outstandingInvoices']) ?? [],
  }
}

async function fetchMessages(threadId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('conversation_messages')
    .select(`
      id,
      direction,
      sender_role,
      message_type,
      body_text,
      sent_at,
      localization:conversation_message_localizations(
        source_language,
        text_en,
        text_th
      )
    `)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true })
    .limit(200)

  return ((data ?? []) as Array<
    TranscriptMessage & {
      localization?:
        | TranscriptMessage['localization']
        | Array<NonNullable<TranscriptMessage['localization']>>
        | null
    }
  >).map((message) => ({
    ...message,
    localization: Array.isArray(message.localization)
      ? message.localization[0] ?? null
      : message.localization ?? null,
  }))
}

export async function persistMessageLocalization(args: {
  threadId?: string | null
  messageId?: string | null
  originalText: string
  counterpartLanguage: Language
  originalLanguage?: Language
  contextMessages?: TranscriptMessage[]
  customerContext?: CustomerContext
  localization?: TranslationResult
}) {
  const sourceLanguage = args.originalLanguage ?? (/[ก-๙]/.test(args.originalText) ? 'th' : 'en')

  const initial: TranslationResult = {
    source_language: sourceLanguage,
    text_th: sourceLanguage === 'th' ? args.originalText : '',
    text_en: sourceLanguage === 'en' ? args.originalText : '',
  }

  let localization = args.localization
  if (!localization) {
    const contextMessages = args.contextMessages ?? []
    const customerContext =
      args.customerContext ??
      (args.threadId
        ? await fetchThreadContext(args.threadId)
        : {
            customer: null,
            vehicles: [],
            recentJobs: [],
            outstandingInvoices: [],
          })
    const transcript = renderTranscript(contextMessages.slice(-6))

    const result = await jsonResponse<TranslationResult>({
      feature: 'translation',
      threadId: args.threadId ?? null,
      messageId: args.messageId ?? null,
      promptCacheKey: `translation:${PROMPT_VERSION}:${sourceLanguage}:${args.counterpartLanguage}`,
      instructions:
        'You translate customer service messages between Thai and English. Preserve names, prices, dates, invoice numbers, bike models, registration plates, phone numbers, URLs, and job facts exactly. Return both Thai and English versions of the same message. Do not add commentary.',
      input: `Business context:\n${buildContextBlock(customerContext)}\n\nRecent transcript:\n${transcript || '(none)'}\n\nCurrent message:\n${args.originalText}`,
      schemaName: 'message_localization',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source_language: { type: 'string', enum: ['th', 'en'] },
          text_th: { type: 'string' },
          text_en: { type: 'string' },
        },
        required: ['source_language', 'text_th', 'text_en'],
      },
      maxOutputTokens: 160,
    })

    localization = result ?? {
      ...initial,
      text_th: initial.text_th || args.originalText,
      text_en: initial.text_en || args.originalText,
    }
  }

  if (!args.messageId) {
    return localization
  }

  const supabase = createAdminClient()
  await supabase.from('conversation_message_localizations').upsert({
    message_id: args.messageId,
    source_language: localization.source_language,
    text_th: localization.text_th,
    text_en: localization.text_en,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    translated_at: new Date().toISOString(),
  })

  return localization
}

async function summarizeThread(args: {
  threadId: string
  customerContext: CustomerContext
  messages: TranscriptMessage[]
  previousSummary: Record<string, unknown>
  lastMessageId: string | null
}) {
  const summary = await jsonResponse<SummaryResult>({
    feature: 'summary',
    threadId: args.threadId,
    promptCacheKey: `summary:${PROMPT_VERSION}`,
    instructions:
      'Summarize the customer conversation for a service advisor. Keep only facts that matter for future translation and reply drafting. Do not invent facts.',
    input: `Business context:\n${buildContextBlock(args.customerContext)}\n\nPrevious summary JSON:\n${JSON.stringify(args.previousSummary, null, 2)}\n\nRecent transcript:\n${renderTranscript(args.messages.slice(-40))}`,
    schemaName: 'thread_summary',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        open_questions: { type: 'array', items: { type: 'string' } },
        commitments: { type: 'array', items: { type: 'string' } },
        customer_preferences: { type: 'array', items: { type: 'string' } },
        important_facts: { type: 'array', items: { type: 'string' } },
        last_customer_intent: { type: 'string' },
      },
      required: [
        'summary',
        'open_questions',
        'commitments',
        'customer_preferences',
        'important_facts',
        'last_customer_intent',
      ],
    },
    maxOutputTokens: 250,
  })

  if (!summary) return false

  const supabase = createAdminClient()
  await supabase.from('conversation_thread_ai_state').upsert({
    thread_id: args.threadId,
    summary_json: summary,
    last_summarized_message_id: args.lastMessageId,
    summarized_message_count: args.messages.length,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
  })

  return true
}

export async function hydrateThreadAssist(threadId: string) {
  const supabase = createAdminClient()
  const customerContext = await fetchThreadContext(threadId)
  const messages = await fetchMessages(threadId)

  let translatedCount = 0
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.message_type && message.message_type !== 'text') continue
    if (!message.body_text) continue
    if (message.localization) continue

    await persistMessageLocalization({
      threadId,
      messageId: message.id,
      originalText: message.body_text,
      contextMessages: messages.slice(Math.max(0, index - 4), index + 1),
      customerContext,
      counterpartLanguage: message.direction === 'inbound' ? 'th' : customerContext.customer?.preferred_language ?? 'en',
    })
    translatedCount += 1
  }

  const { data: aiState } = await supabase
    .from('conversation_thread_ai_state')
    .select('summary_json, summarized_message_count')
    .eq('thread_id', threadId)
    .single()

  const shouldRefreshSummary =
    (messages.length > 0 && !aiState) ||
    messages.length - Number(aiState?.summarized_message_count ?? 0) >= SUMMARY_UNSUMMARIZED_THRESHOLD

  let summaryUpdated = false
  if (shouldRefreshSummary) {
    summaryUpdated = await summarizeThread({
      threadId,
      customerContext,
      messages,
      previousSummary: (aiState?.summary_json as Record<string, unknown>) ?? {},
      lastMessageId: messages[messages.length - 1]?.id ?? null,
    })
  }

  return {
    translatedCount,
    summaryUpdated,
  }
}

export async function draftReply(args: {
  threadId: string
  recipientLanguage: Language
}) {
  const supabase = createAdminClient()
  const customerContext = await fetchThreadContext(args.threadId)
  const messages = await fetchMessages(args.threadId)
  const { data: aiState } = await supabase
    .from('conversation_thread_ai_state')
    .select('summary_json')
    .eq('thread_id', args.threadId)
    .single()

  const result = await jsonResponse<ReplyDraftResult>({
    feature: 'reply_draft',
    threadId: args.threadId,
    promptCacheKey: `reply:${PROMPT_VERSION}:${args.recipientLanguage}`,
    instructions:
      'You help a Thai-speaking service advisor reply to a customer. Draft the advisor reply in Thai. Also provide the customer-facing version in the requested recipient language. Keep the message concise, polite, and operationally accurate.',
    input: `Business context:\n${buildContextBlock(customerContext)}\n\nThread summary JSON:\n${JSON.stringify(aiState?.summary_json ?? {}, null, 2)}\n\nRecent transcript:\n${renderTranscript(messages.slice(-6))}\n\nCustomer preferred language for the outgoing preview: ${args.recipientLanguage}`,
    schemaName: 'reply_draft',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        draft_th: { type: 'string' },
        preview_for_customer: { type: 'string' },
      },
      required: ['draft_th', 'preview_for_customer'],
    },
    maxOutputTokens: 320,
  })

  if (!result) {
    return null
  }

  return result
}
