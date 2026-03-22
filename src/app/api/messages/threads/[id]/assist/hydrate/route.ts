import { createClient } from '@/lib/supabase/server'
import { hydrateThreadAssist } from '@/lib/messaging/ai'
import { forbiddenError, serverError, unauthorizedError } from '@/lib/utils/validation'

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

  try {
    const data = await hydrateThreadAssist(id)
    return Response.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to hydrate thread assist'
    return serverError(message)
  }
}
