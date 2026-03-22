import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLineMessage } from '@/lib/messaging/service'
import {
  unauthorizedError,
  forbiddenError,
  notFoundError,
  serverError,
} from '@/lib/utils/validation'

type Params = { params: Promise<{ id: string }> }

const REQUIRED_PHOTOS = ['left.jpg', 'right.jpg', 'dropoff.jpg'] as const

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
    .select('id, status, driver_id, work_order_id, customer_id')
    .eq('id', id)
    .single()

  if (dwoError || !dwo) return notFoundError('Driver work order')
  if (dwo.driver_id !== user.id) return forbiddenError()

  const storagePath = `driver/delivery/${id}`

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
          message: 'Delivery photos incomplete',
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
      delivery_photos_complete: true,
      status: 'delivered',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  if (!data) return notFoundError('Driver work order')

  // Non-blocking: send proof photo to customer via LINE
  if (dwo.customer_id) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const dropoffPhotoUrl = `${supabaseUrl}/storage/v1/object/public/bgop-photos/${storagePath}/dropoff.jpg`

    const deliveryMessage = `🔧 Butler Garage\n\nรถของคุณส่งถึงที่หมายแล้วครับ ✓ / Your motorcycle has been delivered.\n—\nButler Garage | Bangkok`

    // Fire and forget — do not await
    void sendLineMessage({
      customerId: dwo.customer_id,
      messageType: 'delivery_proof',
      messages: [
        {
          type: 'image',
          originalContentUrl: dropoffPhotoUrl,
          previewImageUrl: dropoffPhotoUrl,
        },
        {
          type: 'text',
          text: deliveryMessage,
        },
      ],
      skipChecks: false,
    }).catch((err) => {
      console.error('[delivery-complete] failed to send LINE proof:', err)
    })
  }

  return Response.json({ data })
}
