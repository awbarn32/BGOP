import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLineMessage } from '@/lib/messaging/service'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const PatchReminderSchema = z.object({
  action: z.enum(['send', 'skip']),
  message_content: z.string().optional(),
})

function buildReminderMessage(
  reminderType: string,
  vehicle: { make: string; model: string; year: number },
  lang: 'th' | 'en' | 'bilingual'
): string {
  const days = reminderType === '180_day' ? '180' : '90'
  const vehicleStr = `${vehicle.make} ${vehicle.model} ${vehicle.year}`

  const thai = `🔧 Butler Garage\n\nครบ ${days} วันแล้วที่รถของคุณไม่ได้รับการบริการ\n${vehicleStr}\nถึงเวลาเช็คสภาพรถหรือยังครับ? ติดต่อเราเพื่อนัดหมายได้เลย\n\n—\nButler Garage | Bangkok`
  const english = `🔧 Butler Garage\n\nIt's been ${days} days since your ${vehicleStr} was last serviced.\nTime for a check-up? Contact us to book your next service.\n\n—\nButler Garage | Bangkok`

  if (lang === 'th') return thai
  if (lang === 'en') return english
  return `${thai}\n\n---\n\n${english}`
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = PatchReminderSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const admin = createAdminClient()

  // Fetch the reminder with its vehicle and customer joins
  const { data: reminder, error: fetchError } = await admin
    .from('vehicle_reminder_log')
    .select(`
      id, vehicle_id, customer_id, reminder_type, decision,
      vehicle:vehicles(make, model, year),
      customer:customers(id, full_name, line_id, preferred_language)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !reminder) return notFoundError('Reminder')

  const now = new Date().toISOString()

  if (parsed.data.action === 'skip') {
    const { data, error } = await admin
      .from('vehicle_reminder_log')
      .update({
        decision: 'skipped',
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return serverError(error.message)
    return Response.json({ data })
  }

  // action === 'send'
  const customer = reminder.customer as unknown as {
    id: string
    full_name: string
    line_id: string | null
    preferred_language: string | null
  } | null

  const vehicle = reminder.vehicle as unknown as {
    make: string
    model: string
    year: number
  } | null

  if (!customer || !vehicle) return serverError('Reminder data incomplete')

  // Derive language
  const prefLang = customer.preferred_language
  const lang: 'th' | 'en' | 'bilingual' =
    prefLang === 'th' ? 'th' : prefLang === 'en' ? 'en' : 'bilingual'

  const messageText = buildReminderMessage(reminder.reminder_type, vehicle, lang)

  // Send the LINE message
  const result = await sendLineMessage({
    customerId: customer.id,
    messageType: 'service_reminder',
    messages: [{ type: 'text', text: messageText }],
    skipChecks: false,
  })

  if (!result.ok && !result.skipped) {
    return serverError(result.error ?? 'Failed to send LINE message')
  }

  const { data, error } = await admin
    .from('vehicle_reminder_log')
    .update({
      decision: 'sent',
      sent_at: now,
      reviewed_by: user.id,
      reviewed_at: now,
      message_content: messageText,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return Response.json({ data, sent: result.ok, demo: result.demo ?? false })
}
