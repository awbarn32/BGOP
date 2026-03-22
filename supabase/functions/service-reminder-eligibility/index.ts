// Supabase Edge Function — service-reminder-eligibility
// CRON: daily at 07:00 Bangkok time (00:00 UTC)
// Finds vehicles eligible for 90-day and 180-day reminders and queues them in vehicle_reminder_log.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'apikey': SERVICE_ROLE_KEY,
  'Prefer': 'return=representation',
}

async function restGet(path: string): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'GET',
    headers: HEADERS,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function restPost(path: string, body: unknown): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

Deno.serve(async (_req) => {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Date thresholds
    const date90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
    const date180 = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000)
    const date90Str = date90.toISOString().split('T')[0]
    const date180Str = date180.toISOString().split('T')[0]

    // ── 1. Fetch vehicles eligible for 90-day reminder ───────────────────────
    // last_service_date <= today-90 AND > today-180, consent=true, line_id not null
    const vehicles90 = await restGet(
      `vehicles?select=id,customer_id,last_service_date,customer:customers(id,line_id,consent_to_message)` +
      `&last_service_date=lte.${date90Str}` +
      `&last_service_date=gt.${date180Str}` +
      `&customer.consent_to_message=eq.true` +
      `&customer.line_id=not.is.null`
    ) as Array<{
      id: string
      customer_id: string
      last_service_date: string
      customer: { id: string; line_id: string | null; consent_to_message: boolean } | null
    }>

    // ── 2. Fetch vehicles eligible for 180-day reminder ──────────────────────
    // last_service_date <= today-180, consent=true, line_id not null
    const vehicles180 = await restGet(
      `vehicles?select=id,customer_id,last_service_date,customer:customers(id,line_id,consent_to_message)` +
      `&last_service_date=lte.${date180Str}` +
      `&customer.consent_to_message=eq.true` +
      `&customer.line_id=not.is.null`
    ) as Array<{
      id: string
      customer_id: string
      last_service_date: string
      customer: { id: string; line_id: string | null; consent_to_message: boolean } | null
    }>

    // ── 3. Filter out vehicles with open jobs ────────────────────────────────
    // Fetch open job vehicle IDs
    const openJobs = await restGet(
      `jobs?select=vehicle_id&status=not.in.(work_completed,returned_to_customer,withdrawn,rejected,archived)`
    ) as Array<{ vehicle_id: string }>

    const openVehicleIds = new Set(openJobs.map((j) => j.vehicle_id))

    // ── 4. Fetch existing log entries to avoid duplicates ───────────────────
    // Get all existing 90_day entries created this cycle (eligible_since = today)
    const existing90Logs = await restGet(
      `vehicle_reminder_log?select=vehicle_id&reminder_type=eq.90_day&eligible_since=eq.${todayStr}`
    ) as Array<{ vehicle_id: string }>

    const existing180Logs = await restGet(
      `vehicle_reminder_log?select=vehicle_id&reminder_type=eq.180_day&eligible_since=eq.${todayStr}`
    ) as Array<{ vehicle_id: string }>

    // Also exclude vehicles that already have any undecided log of same type
    const pendingAny90 = await restGet(
      `vehicle_reminder_log?select=vehicle_id&reminder_type=eq.90_day&decision=is.null`
    ) as Array<{ vehicle_id: string }>

    const pendingAny180 = await restGet(
      `vehicle_reminder_log?select=vehicle_id&reminder_type=eq.180_day&decision=is.null`
    ) as Array<{ vehicle_id: string }>

    const queued90 = new Set([
      ...existing90Logs.map((l) => l.vehicle_id),
      ...pendingAny90.map((l) => l.vehicle_id),
    ])
    const queued180 = new Set([
      ...existing180Logs.map((l) => l.vehicle_id),
      ...pendingAny180.map((l) => l.vehicle_id),
    ])

    // ── 5. Build insert payloads ─────────────────────────────────────────────
    const toInsert90 = vehicles90
      .filter((v) => {
        if (!v.customer?.consent_to_message) return false
        if (!v.customer?.line_id) return false
        if (openVehicleIds.has(v.id)) return false
        if (queued90.has(v.id)) return false
        return true
      })
      .map((v) => ({
        vehicle_id: v.id,
        customer_id: v.customer_id,
        reminder_type: '90_day',
        eligible_since: todayStr,
        decision: null,
      }))

    const toInsert180 = vehicles180
      .filter((v) => {
        if (!v.customer?.consent_to_message) return false
        if (!v.customer?.line_id) return false
        if (openVehicleIds.has(v.id)) return false
        if (queued180.has(v.id)) return false
        return true
      })
      .map((v) => ({
        vehicle_id: v.id,
        customer_id: v.customer_id,
        reminder_type: '180_day',
        eligible_since: todayStr,
        decision: null,
      }))

    // ── 6. Batch insert ──────────────────────────────────────────────────────
    let inserted90 = 0
    let inserted180 = 0

    if (toInsert90.length > 0) {
      await restPost('vehicle_reminder_log', toInsert90)
      inserted90 = toInsert90.length
    }

    if (toInsert180.length > 0) {
      await restPost('vehicle_reminder_log', toInsert180)
      inserted180 = toInsert180.length
    }

    console.log(`[service-reminder-eligibility] inserted90=${inserted90} inserted180=${inserted180}`)

    return Response.json({ inserted90, inserted180, date: todayStr })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[service-reminder-eligibility] error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
})
