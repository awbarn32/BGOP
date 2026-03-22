import { createAdminClient } from '@/lib/supabase/admin'
import { sendLineMessage } from '@/lib/messaging/service'
import { notFoundError, serverError } from '@/lib/utils/validation'
import { transitionJob } from '@/lib/jobs/lifecycle'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // 1. Fetch the job and customer details
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      customer:customers(id, full_name, phone, line_id, preferred_language)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !job) {
    return notFoundError('Job')
  }

  // 2. Prevent re-authorization if already confirmed
  const alreadyConfirmed = [
    'confirmed', 'awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit',
    'received_at_shop', 'awaiting_assignment', 'awaiting_parts', 'awaiting_approval',
    'work_started', 'paused_parts', 'paused_approval', 'work_completed',
    'awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer',
    'archived'
  ].includes(job.status)

  if (alreadyConfirmed) {
    return Response.json({ message: 'Already confirmed' })
  }

  const { error: invoiceError } = await supabase
    .from('invoices')
    .update({ status: 'approved' })
    .eq('job_id', id)
    .eq('status', 'quote')

  if (invoiceError) return serverError(invoiceError.message)

  try {
    await transitionJob({
      supabase,
      jobId: id,
      toBucket: 'new_requests',
      toStatus: 'confirmed',
    })
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'Failed to confirm job')
  }

  // 4. Send a "Thank You" message via LINE if they have a line_id
  const customer = Array.isArray(job.customer) 
    ? job.customer[0] 
    : (job.customer as unknown as { id: string; line_id: string | null; preferred_language: 'th' | 'en' | null })

  if (customer?.line_id) {
    const isThai = customer.preferred_language === 'th'
    const thankYouMsg = isThai 
      ? `ขอบคุณครับ! เราได้รับคำยืนยันการประเมินราคาสำหรับท่านแล้ว ทีมงานกำลังเริ่มดำเนินการให้ท่านครับ`
      : `Thank you! We have received your authorization for the service estimate. Our team is now proceeding with your request.`

    try {
      await sendLineMessage({
        customerId: customer.id,
        jobId: job.id,
        messageType: 'automated_notification',
        messages: [{ type: 'text', text: thankYouMsg }],
        skipChecks: true
      })
    } catch (lineErr: unknown) {
      console.error('Failed to send thank you LINE message:', lineErr)
      // We don't fail the whole request if the LINE notification fails
    }
  }

  return Response.json({ success: true, status: 'confirmed' })
}
