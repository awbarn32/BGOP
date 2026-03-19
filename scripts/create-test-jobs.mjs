/**
 * BGOP Test Job Cards Script
 * Creates realistic [TEST] job cards spread across all 5 Kanban buckets.
 * Run: node scripts/create-test-jobs.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const SUPABASE_URL = 'https://ugmbbcjxvvyadtahetgt.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbWJiY2p4dnZ5YWR0YWhldGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg4MjU4NSwiZXhwIjoyMDg5NDU4NTg1fQ.S9RxrnDHB7bb5gWv4S_LChrD0ukRBfFZr36Fnml3PXU'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Real customer+vehicle pairs from the imported data
const PAIRS = [
  { customer_id: 'a2355aef-63d1-4644-ae0d-368c1d5ac208', vehicle_id: '4cd0d402-5ec3-47c4-80da-0c5018edcb2f', name: 'Ken CK Mark', bike: 'Ducati Multi 950' },
  { customer_id: 'db217c46-7952-4adb-bc3d-45d3f74738ec', vehicle_id: '9ec3db06-a900-4287-a780-5ac6fe17603d', name: 'Kevin Armstrong', bike: 'Suzuki TL1100' },
  { customer_id: '17448f46-a51f-4183-8d57-67b4cbdf1a41', vehicle_id: '47e4a2d3-9932-47b5-b87e-861abc9ddd84', name: 'Charlie Johnathan Durbin', bike: 'Honda CRF250L' },
  { customer_id: '2a83e235-411f-486b-877d-950555afc66b', vehicle_id: '4c6bcc7e-32da-4004-84d9-32ddc5d409be', name: 'Aurilien Simon', bike: 'Triumph 765RS' },
  { customer_id: '97cd0d4b-6c3a-4ef4-bf31-82cb8e36b05a', vehicle_id: '3c541ebf-eb91-4ede-af5a-bc87d65afbf0', name: 'Henry Severs', bike: 'Yamaha XSR900' },
  { customer_id: '9d78ce53-f426-4e43-ae94-31baecca42dc', vehicle_id: '87d7fbb3-eca6-4408-9d04-1d8276df3416', name: 'Tim Lindey', bike: 'KTM 1290' },
  { customer_id: 'c0ae2d01-bc48-4aea-8e0b-042d4dc560a1', vehicle_id: '5e27ab87-4c83-4c0c-bda4-e3c983747a6a', name: 'Ryan Rhul', bike: 'Honda CRF300L' },
  { customer_id: 'c4c9f112-f15b-453b-bc68-1f9129fd4a55', vehicle_id: 'f3eb883e-8e65-4045-b335-20311128a4ea', name: 'George Dniprovski', bike: 'BMW F800R' },
  { customer_id: '346acec3-d45f-442b-9b6a-b26e29fc7f15', vehicle_id: '5dfe477f-b560-4251-bf42-f4070488ebba', name: 'John Aarestrup Sorensen', bike: 'BMW GS850' },
  { customer_id: 'f5f88429-b435-4257-a937-6e6caa35463e', vehicle_id: 'e9da0d6d-3b39-473f-8493-d416f247d6bd', name: 'Ian Worwall', bike: 'Yamaha MT10' },
]

// Test jobs spread across all 5 buckets
const TEST_JOBS = [
  // ── NEW REQUESTS ─────────────────────────────────────────────────────────────
  {
    ...PAIRS[0],
    bucket: 'new_requests',
    status: 'new',
    revenue_stream: 'service',
    logistics_type: 'drop_off',
    description: '[TEST] Customer requesting full 10,000km service. Reports vibration at highway speeds and brake lever feels spongy. Wants quote before proceeding.',
    priority: 1,
  },
  {
    ...PAIRS[1],
    bucket: 'new_requests',
    status: 'under_review',
    revenue_stream: 'ecu',
    logistics_type: null,
    description: '[TEST] ECU remap request — customer wants Stage 2 tune for track day next month. Bike has aftermarket exhaust already fitted.',
    priority: 0,
  },

  // ── INTAKE ───────────────────────────────────────────────────────────────────
  {
    ...PAIRS[2],
    bucket: 'intake',
    status: 'awaiting_drop_off',
    revenue_stream: 'service',
    logistics_type: 'pickup',
    description: '[TEST] Scheduled pickup from customer address in Nonthaburi. Full service + chain replacement + front tyre swap. Customer requested morning slot.',
    intake_mileage: 18420,
    priority: 0,
  },
  {
    ...PAIRS[3],
    bucket: 'intake',
    status: 'received_at_shop',
    revenue_stream: 'service',
    logistics_type: 'drop_off',
    description: '[TEST] Bike received. Customer reported intermittent stalling at low RPM. Initial inspection shows possible fuel pump issue. Awaiting diagnosis.',
    intake_mileage: 32100,
    priority: 2,
  },

  // ── AVAILABLE JOBS ────────────────────────────────────────────────────────────
  {
    ...PAIRS[4],
    bucket: 'available_jobs',
    status: 'awaiting_assignment',
    revenue_stream: 'service',
    logistics_type: 'drop_off',
    description: '[TEST] Full engine service: valve clearance check, cam chain tensioner, coolant flush, spark plugs. Parts already on shelf.',
    intake_mileage: 28750,
    priority: 1,
  },
  {
    ...PAIRS[5],
    bucket: 'available_jobs',
    status: 'awaiting_parts',
    revenue_stream: 'service',
    logistics_type: null,
    description: '[TEST] Brake overhaul front and rear. Ordered braided lines and EBC pads — ETA 2 days. Job ready to start once parts arrive.',
    intake_mileage: 41200,
    priority: 0,
  },

  // ── WIP ──────────────────────────────────────────────────────────────────────
  {
    ...PAIRS[6],
    bucket: 'wip',
    status: 'work_started',
    revenue_stream: 'service',
    logistics_type: 'drop_off',
    description: '[TEST] Engine oil change, filter, air filter clean. Rear tyre replacement — Continental ContiTrailAttack 3. Job started this morning.',
    intake_mileage: 9830,
    priority: 0,
  },
  {
    ...PAIRS[7],
    bucket: 'wip',
    status: 'work_started',
    revenue_stream: 'service',
    logistics_type: 'pickup',
    description: '[TEST] Fork seal replacement both sides — oil leaking. Also doing handlebars and bar-end mirrors while it\'s on the bench. High priority.',
    intake_mileage: 55600,
    priority: 2,
  },

  // ── OUTBOUND ─────────────────────────────────────────────────────────────────
  {
    ...PAIRS[8],
    bucket: 'outbound',
    status: 'work_completed',
    revenue_stream: 'service',
    logistics_type: 'pickup',
    description: '[TEST] Full service completed. Replaced front brake pads, bled brakes, adjusted throttle cable. Ready for driver pickup to customer.',
    intake_mileage: 62300,
    priority: 0,
  },
  {
    ...PAIRS[9],
    bucket: 'outbound',
    status: 'awaiting_pickup',
    revenue_stream: 'service',
    logistics_type: 'drop_off',
    description: '[TEST] ECU flash completed. Stage 1 map loaded, dyno tested — +8hp at peak. Customer notified, coming to collect tomorrow morning.',
    intake_mileage: 14900,
    priority: 0,
  },
]

async function main() {
  console.log('🔧 Creating test job cards...\n')

  for (const job of TEST_JOBS) {
    const { name, bike, ...jobData } = job
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        customer_id: jobData.customer_id,
        vehicle_id: jobData.vehicle_id,
        bucket: jobData.bucket,
        status: jobData.status,
        revenue_stream: jobData.revenue_stream,
        logistics_type: jobData.logistics_type ?? null,
        description: jobData.description,
        intake_mileage: jobData.intake_mileage ?? null,
        priority: jobData.priority ?? 0,
        owner_notify_threshold_thb: 2000,
      })
      .select('id')

    if (error) {
      console.error(`  ❌ ${name} / ${bike}: ${error.message}`)
    } else {
      console.log(`  ✅ [${jobData.bucket.toUpperCase().replace('_',' ')}] ${name} — ${bike}`)
    }
  }

  console.log('\n✅ Done! Check the board at /board')
}

main()
