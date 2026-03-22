import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)

  const { data, error } = await supabase
    .from('conversation_threads')
    .select(`
      id, channel, line_user_id, customer_id, active_job_id,
      latest_message_at, latest_message_preview,
      last_inbound_at, last_outbound_at, resolved_at,
      customer:customers(
        id, full_name, line_id, line_display_name, line_picture_url,
        phone, preferred_language, consent_to_message
      ),
      user_state:conversation_thread_user_state!inner(
        last_read_at, is_resolved, resolved_at
      )
    `)
    .eq('conversation_thread_user_state.user_id', user.id)
    .order('latest_message_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) return serverError(error.message)
  return Response.json({ data: data ?? [] })
}
