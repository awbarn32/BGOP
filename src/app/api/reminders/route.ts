import { createClient } from '@/lib/supabase/server'
import {
  unauthorizedError,
  forbiddenError,
  serverError,
} from '@/lib/utils/validation'

const REMINDER_SELECT = `
  id, vehicle_id, customer_id, reminder_type, eligible_since,
  decision, reviewed_by, reviewed_at, sent_at, message_content, created_at,
  vehicle:vehicles(
    id, make, model, year, color, primary_photo_url, last_service_date
  ),
  customer:customers(
    id, full_name, line_id, preferred_language
  )
`

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (!['owner', 'pa'].includes(role)) return forbiddenError()

  const { searchParams } = new URL(request.url)
  const decisionParam = searchParams.get('decision')

  let query = supabase
    .from('vehicle_reminder_log')
    .select(REMINDER_SELECT)
    .order('eligible_since', { ascending: false })

  if (decisionParam === 'null') {
    query = query.is('decision', null)
  } else if (decisionParam === 'sent') {
    query = query.eq('decision', 'sent')
  } else if (decisionParam === 'skipped') {
    query = query.eq('decision', 'skipped')
  }

  const { data, error } = await query
  if (error) return serverError(error.message)

  return Response.json({ data: data ?? [] })
}
