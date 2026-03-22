import { createClient } from '@/lib/supabase/server'
import { getLocalizationStatus } from '@/lib/messaging/localization'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  const { data, error } = await supabase
    .from('conversation_messages')
    .select(`
      id,
      direction,
      sender_role,
      message_type,
      body_text,
      delivery_status,
      sent_at,
      sent_by_user_id,
      localization:conversation_message_localizations(
        source_language,
        text_en,
        text_th,
        translated_at
      )
    `)
    .eq('thread_id', id)
    .order('sent_at', { ascending: true })
    .limit(200)

  if (error) return serverError(error.message)

  const normalized = (data ?? []).map((message) => {
    const localization = Array.isArray(message.localization)
      ? message.localization[0] ?? null
      : message.localization ?? null

    return {
      ...message,
      localization,
      translation_status: getLocalizationStatus(localization),
    }
  })

  return Response.json({ data: normalized })
}
