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

const token = env.LINE_CHANNEL_ACCESS_TOKEN

if (!token || token === 'placeholder') {
  throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing or still set to placeholder in .env.local')
}

async function fetchLineProfile(lineUserId) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LINE profile fetch failed for ${lineUserId}: ${res.status} ${text}`)
  }

  return res.json()
}

async function upsertCustomerForThread(thread, profile) {
  const fullName = profile.displayName?.trim() || `LINE User ${thread.line_user_id.slice(-6)}`

  const { data: existingCustomer, error: lookupErr } = await supabase
    .from('customers')
    .select('id')
    .eq('line_id', thread.line_user_id)
    .maybeSingle()

  if (lookupErr) throw lookupErr

  let customerId = existingCustomer?.id ?? null

  if (!customerId) {
    const { data: createdCustomer, error: createErr } = await supabase
      .from('customers')
      .insert({
        full_name: fullName,
        line_id: thread.line_user_id,
        line_display_name: profile.displayName ?? null,
        line_picture_url: profile.pictureUrl ?? null,
        consent_to_message: true,
        acquisition_source: 'other',
        preferred_language: 'th',
      })
      .select('id')
      .single()

    if (createErr || !createdCustomer) throw createErr ?? new Error(`Failed to create customer for ${thread.line_user_id}`)
    customerId = createdCustomer.id
  } else {
    const { error: updateErr } = await supabase
      .from('customers')
      .update({
        full_name: fullName,
        line_display_name: profile.displayName ?? null,
        line_picture_url: profile.pictureUrl ?? null,
      })
      .eq('id', customerId)

    if (updateErr) throw updateErr
  }

  const { error: threadErr } = await supabase
    .from('conversation_threads')
    .update({ customer_id: customerId })
    .eq('id', thread.id)

  if (threadErr) throw threadErr

  return customerId
}

async function main() {
  const { data: threads, error } = await supabase
    .from('conversation_threads')
    .select('id, line_user_id, customer_id')
    .not('line_user_id', 'is', null)
    .order('latest_message_at', { ascending: false })
    .limit(200)

  if (error) throw error

  let updatedCustomers = 0
  let updatedThreads = 0

  for (const thread of threads ?? []) {
    if (!thread.line_user_id) continue

    const profile = await fetchLineProfile(thread.line_user_id)
    const customerId = await upsertCustomerForThread(thread, profile)

    if (customerId) {
      updatedCustomers += 1
      updatedThreads += 1
    }
  }

  console.log(JSON.stringify({ updatedCustomers, updatedThreads }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
