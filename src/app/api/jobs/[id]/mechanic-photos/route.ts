import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const AddPhotoSchema = z.object({
  url: z.string().url(),
})

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'mechanic') return forbiddenError()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const parsed = AddPhotoSchema.safeParse(body)
  if (!parsed.success) return validationError('Validation failed', parsed.error.flatten())

  const admin = createAdminClient()

  // Verify mechanic is assigned to this job
  const { data: job, error: fetchError } = await admin
    .from('jobs')
    .select('id, mechanic_id, mechanic_photos')
    .eq('id', id)
    .single()

  if (fetchError || !job) return notFoundError('Job')

  if (job.mechanic_id !== user.id) {
    return forbiddenError()
  }

  // Append photo URL to the array
  const existing: string[] = Array.isArray(job.mechanic_photos) ? job.mechanic_photos : []
  const updated = [...existing, parsed.data.url]

  const { data, error } = await admin
    .from('jobs')
    .update({ mechanic_photos: updated })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Job')
  return Response.json({ data }, { status: 201 })
}
