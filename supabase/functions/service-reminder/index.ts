// Supabase Edge Function — service-reminder
// CRON: daily at 08:00 Bangkok time (01:00 UTC)
// Finds vehicles due for service in the next 7 days and sends LINE messages.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!

async function sendLineMessage(lineId: string, message: string): Promise<boolean> {
  if (!LINE_TOKEN) return false
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineId,
      messages: [{ type: 'text', text: message }],
    }),
  })
  return res.ok
}

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const today = new Date()
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Find vehicles with last_service_date between today-1year and today, due for annual service
  // OR explicit service_date set within next 7 days
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select(`
      id, make, model, year, license_plate, last_service_date,
      customer:customers(id, full_name, phone, line_id, consent_to_message, preferred_language)
    `)
    .not('last_service_date', 'is', null)
    .gte('last_service_date', new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .lte('last_service_date', in7Days.toISOString().split('T')[0])

  if (error) {
    console.error('Failed to fetch vehicles:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const vehicle of vehicles ?? []) {
    const customer = vehicle.customer as {
      id: string; full_name: string; phone: string | null;
      line_id: string | null; consent_to_message: boolean; preferred_language: string
    } | null

    if (!customer?.consent_to_message || !customer?.line_id) {
      skipped++
      continue
    }

    const isThai = customer.preferred_language === 'th'
    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.license_plate ? ` (${vehicle.license_plate})` : ''}`

    const message = isThai
      ? `สวัสดีครับ/ค่ะ คุณ${customer.full_name}\n\nรถ ${vehicleName} ของคุณถึงเวลาเข้ารับการบำรุงรักษาประจำปีแล้ว 🔧\n\nสนใจนัดหมายหรือสอบถามข้อมูลเพิ่มเติม กรุณาตอบกลับข้อความนี้\n\n— Butler Garage`
      : `Hi ${customer.full_name},\n\nYour ${vehicleName} is due for its annual service 🔧\n\nReply to this message to book an appointment.\n\n— Butler Garage`

    const ok = await sendLineMessage(customer.line_id, message)

    if (ok) {
      sent++
      // Log to message_log
      await supabase.from('message_log').insert({
        customer_id: customer.id,
        channel: 'line',
        message_type: 'service_reminder',
        content: message,
      })
    } else {
      skipped++
    }
  }

  return Response.json({ sent, skipped, total: (vehicles ?? []).length })
})
