/**
 * GET /api/approvals
 *
 * Returns invoices that are pending_owner_approval or recently reviewed (approved/owner_declined).
 * Owner and PA only. Owner sees this for action; PA sees it read-only.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const APPROVAL_SELECT = `
  id,
  invoice_number,
  status,
  total_amount,
  submitted_for_approval_at,
  approved_by,
  approved_at,
  owner_decline_reason,
  job:jobs (
    id,
    status,
    description,
    revenue_stream,
    customer:customers ( id, full_name, phone, preferred_language ),
    vehicle:vehicles ( make, model, year, color )
  ),
  line_items:job_line_items (
    id,
    line_type,
    description,
    quantity,
    sale_price,
    is_scope_change
  )
`

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })

  const role = user.app_metadata?.role as string
  if (role !== 'owner' && role !== 'pa') {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('invoices')
    .select(APPROVAL_SELECT)
    .in('status', ['pending_owner_approval', 'approved', 'owner_declined'])
    .order('submitted_for_approval_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
