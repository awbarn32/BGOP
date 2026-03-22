// GET /api/customers/[id]/duplicates
// Returns potential duplicate customers by matching normalized phone or similar name
import { createClient } from '@/lib/supabase/server'

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('66') && digits.length > 9) {
    digits = '0' + digits.slice(2)
  }
  return digits
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  // Get the current customer
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, line_id, email')
    .eq('id', params.id)
    .single()

  if (error || !customer) {
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  const duplicates: Array<{
    id: string
    full_name: string
    phone: string | null
    email: string | null
    match_reason: string
  }> = []

  // 1. Search by normalized phone (digits-only comparison)
  if (customer.phone) {
    const normalized = normalizePhone(customer.phone)
    if (normalized.length >= 6) {
      const { data: phoneMatches } = await supabase
        .from('customers')
        .select('id, full_name, phone, email')
        .neq('id', customer.id)

      if (phoneMatches) {
        for (const c of phoneMatches) {
          if (c.phone && normalizePhone(c.phone) === normalized) {
            duplicates.push({ ...c, match_reason: 'Same phone number' })
          }
        }
      }
    }
  }

  // 2. Search by name (case-insensitive, if name is at least 3 chars)
  const name = customer.full_name?.trim()
  if (name && name.length >= 3) {
    const { data: nameMatches } = await supabase
      .from('customers')
      .select('id, full_name, phone, email')
      .neq('id', customer.id)
      .ilike('full_name', `%${name}%`)
      .limit(5)

    if (nameMatches) {
      for (const c of nameMatches) {
        if (!duplicates.some((d) => d.id === c.id)) {
          duplicates.push({ ...c, match_reason: 'Similar name' })
        }
      }
    }
  }

  // 3. Search by LINE ID
  if (customer.line_id) {
    const { data: lineMatches } = await supabase
      .from('customers')
      .select('id, full_name, phone, email')
      .neq('id', customer.id)
      .eq('line_id', customer.line_id)
      .limit(3)

    if (lineMatches) {
      for (const c of lineMatches) {
        if (!duplicates.some((d) => d.id === c.id)) {
          duplicates.push({ ...c, match_reason: 'Same LINE ID' })
        }
      }
    }
  }

  return Response.json({ data: duplicates })
}
