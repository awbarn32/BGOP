import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const env = {}

  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    env[line.slice(0, idx)] = line.slice(idx + 1).trim()
  }

  return env
}

const env = loadEnv('.env.local')
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const UNKNOWN_LINE_RE = /^\[Unknown LINE user: ([^\]]+)\]\n?/

function parseLegacyContact(row, customersById) {
  const match = (row.content ?? '').match(UNKNOWN_LINE_RE)
  if (match) {
    return {
      lineUserId: match[1],
      customerId: row.customer_id ?? null,
      bodyText: (row.content ?? '').replace(UNKNOWN_LINE_RE, ''),
    }
  }

  if (row.customer_id && customersById.has(row.customer_id)) {
    const customer = customersById.get(row.customer_id)
    if (customer?.line_id) {
      return {
        lineUserId: customer.line_id,
        customerId: row.customer_id,
        bodyText: row.content ?? null,
      }
    }
  }

  return null
}

function getDirection(messageType) {
  return messageType === 'inbound' ? 'inbound' : 'outbound'
}

function getSenderRole(messageType) {
  return messageType === 'inbound' ? 'customer' : 'pa'
}

async function main() {
  const [{ count: existingCount, error: existingErr }, { data: messageLog, error: logErr }, { data: staffUsers, error: staffErr }, { data: customers, error: customerErr }] = await Promise.all([
    supabase.from('conversation_messages').select('id', { count: 'exact', head: true }),
    supabase
      .from('message_log')
      .select('id, customer_id, job_id, message_type, content, status, sent_at')
      .order('sent_at', { ascending: true })
      .limit(1000),
    supabase
      .from('users')
      .select('id')
      .in('role', ['owner', 'pa']),
    supabase
      .from('customers')
      .select('id, line_id'),
  ])

  if (existingErr) throw existingErr
  if (logErr) throw logErr
  if (staffErr) throw staffErr
  if (customerErr) throw customerErr

  if ((existingCount ?? 0) > 0) {
    throw new Error(`conversation_messages already has ${existingCount} rows; refusing to backfill into a non-empty inbox`)
  }

  const customersById = new Map((customers ?? []).map((customer) => [customer.id, customer]))
  const staffIds = (staffUsers ?? []).map((user) => user.id)

  let migratedThreads = 0
  let migratedMessages = 0
  let skippedMessages = 0
  const threadIds = new Map()

  for (const row of messageLog ?? []) {
    const parsed = parseLegacyContact(row, customersById)
    if (!parsed?.lineUserId) {
      skippedMessages += 1
      continue
    }

    let threadId = threadIds.get(parsed.lineUserId)

    if (!threadId) {
      const { data: thread, error: threadErr } = await supabase
        .from('conversation_threads')
        .upsert({
          channel: 'line',
          line_user_id: parsed.lineUserId,
          customer_id: parsed.customerId,
          active_job_id: row.job_id ?? null,
          latest_message_at: row.sent_at,
          latest_message_preview: (parsed.bodyText ?? '').slice(0, 100),
          last_inbound_at: row.message_type === 'inbound' ? row.sent_at : null,
          last_outbound_at: row.message_type === 'inbound' ? null : row.sent_at,
        }, { onConflict: 'channel,line_user_id' })
        .select('id')
        .single()

      if (threadErr || !thread) throw threadErr ?? new Error(`Failed to create thread for ${parsed.lineUserId}`)

      threadId = thread.id
      threadIds.set(parsed.lineUserId, threadId)
      migratedThreads += 1
    } else {
      const update = {
        customer_id: parsed.customerId,
        active_job_id: row.job_id ?? null,
        latest_message_at: row.sent_at,
        latest_message_preview: (parsed.bodyText ?? '').slice(0, 100),
        last_inbound_at: row.message_type === 'inbound' ? row.sent_at : undefined,
        last_outbound_at: row.message_type === 'inbound' ? undefined : row.sent_at,
      }

      const { error: updateErr } = await supabase
        .from('conversation_threads')
        .update(update)
        .eq('id', threadId)

      if (updateErr) throw updateErr
    }

    const { error: messageErr } = await supabase
      .from('conversation_messages')
      .insert({
        thread_id: threadId,
        direction: getDirection(row.message_type),
        sender_role: getSenderRole(row.message_type),
        message_type: row.message_type === 'inbound' ? 'text' : row.message_type,
        body_text: parsed.bodyText,
        delivery_status: row.status ?? 'sent',
        sent_at: row.sent_at,
        raw_payload: { legacy_message_log_id: row.id },
      })

    if (messageErr) throw messageErr
    migratedMessages += 1

    if (row.message_type === 'inbound' && staffIds.length > 0) {
      const { error: stateErr } = await supabase
        .from('conversation_thread_user_state')
        .upsert(
          staffIds.map((userId) => ({
            thread_id: threadId,
            user_id: userId,
            is_resolved: false,
            resolved_at: null,
          })),
          { onConflict: 'thread_id,user_id' }
        )

      if (stateErr) throw stateErr
    }
  }

  console.log(JSON.stringify({
    migratedThreads,
    migratedMessages,
    skippedMessages,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
