// Supabase Edge Function — dormant-segmentation
// CRON: weekly on Sunday at 02:00 UTC
// Marks customers as dormant if they haven't had a job in 12+ months.
// Marks them active again if a recent job exists.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DORMANT_MONTHS = 12

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - DORMANT_MONTHS)
  const cutoffDate = cutoff.toISOString()

  // Find all customers with their most recent job date
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, dormant')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let markedDormant = 0
  let markedActive = 0

  for (const customer of customers ?? []) {
    // Check most recent job
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('id, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastJobDate = recentJobs?.[0]?.created_at ?? null
    const shouldBeDormant = !lastJobDate || lastJobDate < cutoffDate

    if (shouldBeDormant && !customer.dormant) {
      await supabase.from('customers').update({ dormant: true }).eq('id', customer.id)
      markedDormant++
    } else if (!shouldBeDormant && customer.dormant) {
      await supabase.from('customers').update({ dormant: false }).eq('id', customer.id)
      markedActive++
    }
  }

  return Response.json({
    total: (customers ?? []).length,
    marked_dormant: markedDormant,
    marked_active: markedActive,
  })
})
