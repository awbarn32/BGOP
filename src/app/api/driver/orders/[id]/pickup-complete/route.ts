import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const REQUIRED_PHOTOS = ['left.jpg', 'right.jpg', 'loaded.jpg'] as const

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedError()

  const role = user.app_metadata?.role
  if (role !== 'driver') return forbiddenError()

  const admin = createAdminClient()

  // Verify the driver work order exists and belongs to this driver
  const { data: dwo, error: dwoError } = await admin
    .from('driver_work_orders')
    .select('id, status, driver_id, work_order_id')
    .eq('id', id)
    .single()

  if (dwoError || !dwo) return notFoundError('Driver work order')
  if (dwo.driver_id !== user.id) return forbiddenError()

  const storagePath = `driver/pickup/${id}`

  // Check existence of all required photos
  const { data: files, error: storageError } = await admin.storage
    .from('bgop-photos')
    .list(storagePath)

  if (storageError) return serverError(storageError.message)

  const existingFiles = new Set((files ?? []).map((f) => f.name))
  const missing = REQUIRED_PHOTOS.filter((photo) => !existingFiles.has(photo))

  if (missing.length > 0) {
    return Response.json(
      {
        error: {
          message: 'Pickup photos incomplete',
          missing: missing.map((f) => `${storagePath}/${f}`),
        },
      },
      { status: 422 }
    )
  }

  // All photos present — update DWO
  const { data, error } = await admin
    .from('driver_work_orders')
    .update({
      pickup_photos_complete: true,
      status: 'picked_up',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Driver work order')
  return Response.json({ data })
}
