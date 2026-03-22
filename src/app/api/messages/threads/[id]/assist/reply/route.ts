import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { draftReply, hydrateThreadAssist } from '@/lib/messaging/ai'
import {
  forbiddenError,
  serverError,
  unauthorizedError,
  validationError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const ReplySchema = z.object({
  recipient_language: z.enum(['th', 'en']).default('en'),
  current_draft_th: z.string().trim().max(4000).optional(),
  revision_request: z.string().trim().max(2000).optional(),
})

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') return forbiddenError()

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = ReplySchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  try {
    await hydrateThreadAssist(id)
    const data = await draftReply({
      threadId: id,
      recipientLanguage: parsed.data.recipient_language,
      currentDraftTh: parsed.data.current_draft_th,
      revisionRequest: parsed.data.revision_request,
    })

    if (!data) return serverError('Reply suggestion unavailable')
    return Response.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to draft reply'
    return serverError(message)
  }
}
