// Supabase Edge Function — ar-followup
// CRON: weekly on Monday at 09:00 Bangkok time (02:00 UTC)
// Sends LINE reminders for invoices overdue by 7, 30, and 60 days.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!

const FOLLOWUP_DAYS = [7, 30, 60]

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

  // Find unpaid invoices (not void, not paid) with invoice_date in past
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, total_amount, status,
      customer:customers(id, full_name, line_id, consent_to_message, preferred_language)
    `)
    .in('status', ['approved', 'deposit_paid', 'pending'])
    .lt('invoice_date', today.toISOString().split('T')[0])

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const invoice of invoices ?? []) {
    const customer = invoice.customer as {
      id: string; full_name: string; line_id: string | null;
      consent_to_message: boolean; preferred_language: string
    } | null

    if (!customer?.consent_to_message || !customer?.line_id) {
      skipped++
      continue
    }

    const daysOverdue = Math.floor(
      (today.getTime() - new Date(invoice.invoice_date).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Only send on specific overdue thresholds
    if (!FOLLOWUP_DAYS.includes(daysOverdue)) {
      skipped++
      continue
    }

    const isThai = customer.preferred_language === 'th'
    const amountStr = new Intl.NumberFormat('th-TH').format(invoice.total_amount)
    const invoiceRef = invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()

    const message = isThai
      ? `สวัสดีครับ/ค่ะ คุณ${customer.full_name}\n\nใบแจ้งหนี้ #${invoiceRef} จำนวน ฿${amountStr} ยังค้างชำระอยู่ (${daysOverdue} วัน)\n\nกรุณาติดต่อทีมงานเพื่อชำระเงิน หรือตอบกลับข้อความนี้\n\n— Butler Garage`
      : `Hi ${customer.full_name},\n\nInvoice #${invoiceRef} for ฿${amountStr} is ${daysOverdue} days overdue.\n\nPlease arrange payment or reply to discuss.\n\n— Butler Garage`

    const ok = await sendLineMessage(customer.line_id, message)

    if (ok) {
      sent++
      await supabase.from('message_log').insert({
        customer_id: customer.id,
        channel: 'line',
        message_type: 'ar_followup',
        content: message,
      })
    } else {
      skipped++
    }
  }

  return Response.json({ sent, skipped, total: (invoices ?? []).length })
})
