import { createClient } from '@/lib/supabase/server'
import { unauthorizedError, forbiddenError, serverError } from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  const { error } = await supabase
    .from('conversation_thread_user_state')
    .upsert(
      {
        thread_id: id,
        user_id: user.id,
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: 'thread_id,user_id' }
    )

  if (error) return serverError(error.message)
  return Response.json({ success: true })
}
