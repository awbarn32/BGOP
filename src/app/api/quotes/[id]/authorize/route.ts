import { createAdminClient } from '@/lib/supabase/admin'
import { sendLineMessage } from '@/lib/messaging/service'
import { validationError, notFoundError, serverError } from '@/lib/utils/validation'

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
    'confirmed', 'awaiting_drop_off', 'work_started', 'work_completed', 'archived'
  ].includes(job.status)

  if (alreadyConfirmed) {
    return Response.json({ message: 'Already confirmed' })
  }

  // 3. Update the job status
  const { error: updateError } = await supabase
    .from('jobs')
    .update({ status: 'confirmed' })
    .eq('id', id)

  if (updateError) {
    return serverError(updateError.message)
  }

  // 4. Send a "Thank You" message via LINE if they have a line_id
  const customer = job.customer as any
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
    } catch (lineErr) {
      console.error('Failed to send thank you LINE message:', lineErr)
      // We don't fail the whole request if the LINE notification fails
    }
  }

  return Response.json({ success: true, status: 'confirmed' })
}
