// POST /api/customers/[id]/merge
// Merges another customer INTO this one (keeps this customer, removes the other)
// Body: { merge_from_id: string }
// - Reassigns all vehicles, jobs, invoices from merge_from_id → id
// - Deletes the merge_from_id customer record
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const BodySchema = z.object({
  merge_from_id: z.string().uuid(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Auth check — only owner/pa can merge
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }
  const role = user.app_metadata?.role
  if (role !== 'owner' && role !== 'pa') {
    return Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parse = BodySchema.safeParse(body)
  if (!parse.success) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'merge_from_id is required' } }, { status: 400 })
  }

  const keepId = params.id
  const removeId = parse.data.merge_from_id

  if (keepId === removeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot merge customer into itself' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify both customers exist
  const [keepRes, removeRes] = await Promise.all([
    admin.from('customers').select('id, full_name').eq('id', keepId).single(),
    admin.from('customers').select('id, full_name').eq('id', removeId).single(),
  ])

  if (keepRes.error || !keepRes.data) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Target customer not found' } }, { status: 404 })
  }
  if (removeRes.error || !removeRes.data) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Source customer not found' } }, { status: 404 })
  }

  // Reassign all related records from removeId → keepId
  // Only update tables that have a customer_id foreign key
  const updates = await Promise.all([
    admin.from('vehicles').update({ customer_id: keepId }).eq('customer_id', removeId),
    admin.from('jobs').update({ customer_id: keepId }).eq('customer_id', removeId),
    admin.from('invoices').update({ customer_id: keepId }).eq('customer_id', removeId),
    // Clear any self-referential related_customer_id pointing to the duplicate
    admin.from('customers').update({ related_customer_id: null }).eq('related_customer_id', removeId),
  ])

  const errors = updates.filter((u) => u.error)
  if (errors.length > 0) {
    return Response.json(
      { error: { code: 'DB_ERROR', message: 'Failed to reassign some records', details: errors.map((e) => e.error?.message) } },
      { status: 500 }
    )
  }

  // Delete the duplicate customer
  const { error: deleteError } = await admin
    .from('customers')
    .delete()
    .eq('id', removeId)

  if (deleteError) {
    return Response.json(
      { error: { code: 'DB_ERROR', message: `Records reassigned but failed to delete duplicate: ${deleteError.message}` } },
      { status: 500 }
    )
  }

  return Response.json({
    data: {
      kept: { id: keepId, full_name: keepRes.data.full_name },
      removed: { id: removeId, full_name: removeRes.data.full_name },
    },
  })
}
