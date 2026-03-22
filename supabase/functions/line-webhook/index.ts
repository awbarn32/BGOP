import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
const LINE_CHANNEL_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''

Deno.serve(async (req) => {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (LINE_CHANNEL_SECRET) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(LINE_CHANNEL_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))

    if (expected !== signature) {
      console.warn('[line-webhook] invalid signature')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let payload: { events?: LineEvent[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  processEvents(supabase, payload.events ?? []).catch(console.error)

  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

interface LineEvent {
  type: string
  webhookEventId?: string
  source?: { userId?: string }
  message?: { type: string; text?: string; id?: string }
  postback?: { data: string }
  replyToken?: string
  timestamp?: number
}

async function processEvents(
  supabase: ReturnType<typeof createClient>,
  events: LineEvent[]
) {
  for (const event of events) {
    if (event.webhookEventId) {
      const { error } = await supabase
        .from('line_webhook_events')
        .insert({ webhook_event_id: event.webhookEventId })

      if (error) {
        console.log('[line-webhook] duplicate event skipped:', event.webhookEventId)
        continue
      }
    }

    const lineUserId = event.source?.userId
    if (!lineUserId) continue

    try {
      if (event.type === 'message' && event.message?.type === 'text') {
        await handleTextMessage(supabase, lineUserId, event.message.text ?? '', event)
      } else if (event.type === 'postback' && event.postback?.data) {
        await handlePostback(supabase, event.postback.data)
      }
    } catch (err) {
      console.error('[line-webhook] event processing error', err)
    }
  }
}

async function handleTextMessage(
  supabase: ReturnType<typeof createClient>,
  lineUserId: string,
  text: string,
  rawEvent: LineEvent
) {
  let { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, line_picture_url')
    .eq('line_id', lineUserId)
    .single()

  if (!customer) {
    const profile = await fetchLineProfile(lineUserId)

    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        full_name: profile?.displayName ?? `LINE User ${lineUserId.slice(-6)}`,
        line_id: lineUserId,
        line_display_name: profile?.displayName ?? null,
        line_picture_url: profile?.pictureUrl ?? null,
        consent_to_message: true,
        acquisition_source: 'other',
        preferred_language: 'th',
      })
      .select('id, full_name, line_picture_url')
      .single()

    if (error || !newCustomer) {
      console.error('[line-webhook] customer creation failed', error)
      return
    }

    customer = newCustomer
  } else if (!customer.line_picture_url) {
    const profile = await fetchLineProfile(lineUserId)
    if (profile) {
      await supabase
        .from('customers')
        .update({
          line_display_name: profile.displayName,
          line_picture_url: profile.pictureUrl ?? null,
        })
        .eq('line_id', lineUserId)
    }
  }

  const { data: activeJob } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customer.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  await recordConversationMessage(supabase, {
    lineUserId,
    customerId: customer.id,
    direction: 'inbound',
    senderRole: 'customer',
    messageType: 'text',
    bodyText: text,
    activeJobId: activeJob?.id ?? null,
    rawPayload: rawEvent as Record<string, unknown>,
  })
}

async function handlePostback(
  supabase: ReturnType<typeof createClient>,
  data: string
) {
  if (!data.startsWith('scope_approve:') && !data.startsWith('scope_decline:')) return

  const [action, scopeId] = data.split(':')
  const approved = action === 'scope_approve'

  const { data: scope } = await supabase
    .from('scope_changes')
    .select('id, job_id, status, description, amount_thb')
    .eq('id', scopeId)
    .single()

  if (!scope || scope.status !== 'flagged') return

  await supabase
    .from('scope_changes')
    .update({
      status: approved ? 'approved' : 'declined',
      customer_response_at: new Date().toISOString(),
    })
    .eq('id', scopeId)

  if (approved) {
    await supabase.from('job_line_items').insert({
      job_id: scope.job_id,
      line_type: 'labour',
      description: scope.description,
      quantity: 1,
      sale_price: scope.amount_thb,
      is_scope_change: true,
      cost_estimated: true,
    })

    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, total_amount')
      .eq('job_id', scope.job_id)
      .not('status', 'in', '("paid","void")')
      .single()

    if (invoice) {
      await supabase
        .from('invoices')
        .update({ total_amount: invoice.total_amount + scope.amount_thb })
        .eq('id', invoice.id)
    }
  }
}

async function fetchLineProfile(lineUserId: string) {
  if (!LINE_CHANNEL_TOKEN) return null

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${LINE_CHANNEL_TOKEN}` },
    })

    if (!res.ok) return null
    return (await res.json()) as { displayName: string; pictureUrl?: string }
  } catch {
    return null
  }
}

async function recordConversationMessage(
  supabase: ReturnType<typeof createClient>,
  opts: {
    lineUserId: string
    customerId: string | null
    direction: string
    senderRole: string
    messageType: string
    bodyText: string | null
    activeJobId: string | null
    rawPayload?: Record<string, unknown>
  }
) {
  const now = new Date().toISOString()
  const threadData: Record<string, unknown> = {
    channel: 'line',
    line_user_id: opts.lineUserId,
    customer_id: opts.customerId,
    active_job_id: opts.activeJobId,
    latest_message_at: now,
    latest_message_preview: (opts.bodyText ?? '').slice(0, 100),
    last_inbound_at: now,
  }

  const { data: thread } = await supabase
    .from('conversation_threads')
    .upsert(threadData, { onConflict: 'channel,line_user_id' })
    .select('id')
    .single()

  if (!thread) return

  await supabase.from('conversation_messages').insert({
    thread_id: thread.id,
    direction: opts.direction,
    sender_role: opts.senderRole,
    message_type: opts.messageType,
    body_text: opts.bodyText,
    raw_payload: opts.rawPayload ?? null,
  })

  const { data: staffUsers } = await supabase
    .from('users')
    .select('id')
    .in('role', ['owner', 'pa'])

  if (staffUsers) {
    await supabase
      .from('conversation_thread_user_state')
      .upsert(
        staffUsers.map((staffUser) => ({
          thread_id: thread.id,
          user_id: staffUser.id,
          is_resolved: false,
        })),
        { onConflict: 'thread_id,user_id' }
      )
      .catch(() => {})
  }

  await supabase
    .from('message_log')
    .insert({
      customer_id: opts.customerId,
      job_id: opts.activeJobId,
      channel: 'line',
      message_type: 'inbound',
      content: opts.bodyText,
      status: 'delivered',
    })
    .catch(() => {})
}
