// GET /api/quote/[id] — PUBLIC (no auth required)
// Returns minimal quote data for the customer-facing approval page.
// id = job_id

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // Use service role to bypass RLS for public quote view
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data: job, error } = await admin
    .from('jobs')
    .select(`
      id, description, status, revenue_stream, created_at,
      customer:customers(id, full_name, preferred_language),
      vehicle:vehicles(id, make, model, year, color, license_plate),
      invoice:invoices(
        id, invoice_number, status, total_amount, deposit_amount, notes,
        line_items:job_line_items(id, line_type, description, quantity, sale_price, is_scope_change)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !job) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Quote not found' } }, { status: 404 })
  }

  // Only expose quote/quote_sent stage jobs — don't let customer see post-approval details
  const allowedStatuses = ['new', 'under_review', 'awaiting_customer', 'quote_sent', 'confirmed']
  if (!allowedStatuses.includes(job.status)) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Quote not available' } }, { status: 404 })
  }

  const invoiceArr = job.invoice as unknown as Array<{
    id: string; invoice_number: string | null; status: string;
    total_amount: number; deposit_amount: number | null; notes: string | null;
    line_items: Array<{
      id: string; line_type: string; description: string;
      quantity: number; sale_price: number; is_scope_change: boolean
    }>
  }>
  const invoice = invoiceArr?.[0] ?? null

  return Response.json({
    data: {
      job: {
        id: job.id,
        description: job.description,
        status: job.status,
        revenue_stream: job.revenue_stream,
        created_at: job.created_at,
      },
      customer: {
        full_name: (job.customer as unknown as { full_name: string; preferred_language: string }).full_name,
        preferred_language: (job.customer as unknown as { preferred_language: string }).preferred_language,
      },
      vehicle: job.vehicle,
      invoice,
    },
  })
}
