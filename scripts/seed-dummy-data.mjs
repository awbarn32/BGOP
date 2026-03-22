/**
 * BGOP Dummy Data Seed Script
 * Creates an owner user + 10 test jobs across all buckets, with motorcycle photos.
 *
 * Run: node scripts/seed-dummy-data.mjs
 *
 * IMPORTANT: You must first create an owner account in the Supabase Auth dashboard,
 * then pass their UUID as OWNER_USER_ID below, so RLS policies work correctly.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ugmbbcjxvvyadtahetgt.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbWJiY2p4dnZ5YWR0YWhldGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg4MjU4NSwiZXhwIjoyMDg5NDU4NTg1fQ.S9RxrnDHB7bb5gWv4S_LChrD0ukRBfFZr36Fnml3PXU'

// ─── Motorcycle photos (public URLs — no auth needed) ────────────────────────
// Using high-quality Wikimedia Commons / public domain motorcycle photos
const MOTO_PHOTOS = {
  ducati:    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ducati_Multistrada_950.jpg/1280px-Ducati_Multistrada_950.jpg',
  suzuki:    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/2016_Suzuki_TL1000S_%28orange%29.jpg/1280px-2016_Suzuki_TL1000S_%28orange%29.jpg',
  honda_crf: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Honda_CRF250L_2012.jpg/1280px-Honda_CRF250L_2012.jpg',
  triumph:   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/2017_Triumph_Street_Triple_RS.jpg/1280px-2017_Triumph_Street_Triple_RS.jpg',
  yamaha_xsr:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/2016_Yamaha_XSR900_%28YA10%29.jpg/1280px-2016_Yamaha_XSR900_%28YA10%29.jpg',
  ktm:       'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/KTM_1290_Super_Duke_R_2020.jpg/1280px-KTM_1290_Super_Duke_R_2020.jpg',
  honda_crf3:'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Honda_CRF300L.jpg/1280px-Honda_CRF300L.jpg',
  bmw_f800:  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/2009_BMW_F800R.jpg/1280px-2009_BMW_F800R.jpg',
  bmw_gs:    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/2013_BMW_R1200GS.jpg/1280px-2013_BMW_R1200GS.jpg',
  yamaha_mt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/2016_Yamaha_MT-10_%28YA01%29.jpg/1280px-2016_Yamaha_MT-10_%28YA01%29.jpg',
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── Demo Customers ──────────────────────────────────────────────────────────
const CUSTOMERS = [
  { full_name: 'Ken CK Mark',               phone: '+66-81-001-0001', preferred_language: 'en' },
  { full_name: 'Kevin Armstrong',           phone: '+66-81-001-0002', preferred_language: 'en' },
  { full_name: 'Charlie Durbin',            phone: '+66-81-001-0003', preferred_language: 'en' },
  { full_name: 'Aurelien Simon',            phone: '+66-81-001-0004', preferred_language: 'en' },
  { full_name: 'Henry Severs',              phone: '+66-81-001-0005', preferred_language: 'en' },
  { full_name: 'Tim Lindey',                phone: '+66-81-001-0006', preferred_language: 'en' },
  { full_name: 'Ryan Ruhl',                 phone: '+66-81-001-0007', preferred_language: 'en' },
  { full_name: 'George Dniprovski',         phone: '+66-81-001-0008', preferred_language: 'en' },
  { full_name: 'John Sorensen',             phone: '+66-81-001-0009', preferred_language: 'en' },
  { full_name: 'Ian Worwall',               phone: '+66-81-001-0010', preferred_language: 'en' },
]

// ─── Demo Vehicles (keyed by index, matching customer array) ─────────────────
const VEHICLES = [
  { make: 'ducati',    model: 'Multistrada 950', year: 2022, license_plate: 'กข-1001' },
  { make: 'suzuki',    model: 'TL1100',          year: 2002, license_plate: 'กข-1002' },
  { make: 'honda',     model: 'CRF250L',         year: 2021, license_plate: 'กข-1003' },
  { make: 'triumph',   model: 'Street Triple 765RS', year: 2020, license_plate: 'กข-1004' },
  { make: 'yamaha',    model: 'XSR900',          year: 2019, license_plate: 'กข-1005' },
  { make: 'ktm',       model: '1290 Super Duke R', year: 2021, license_plate: 'กข-1006' },
  { make: 'honda',     model: 'CRF300L',         year: 2023, license_plate: 'กข-1007' },
  { make: 'bmw',       model: 'F800R',           year: 2018, license_plate: 'กข-1008' },
  { make: 'bmw',       model: 'R1200GS',         year: 2017, license_plate: 'กข-1009' },
  { make: 'yamaha',    model: 'MT-10',            year: 2020, license_plate: 'กข-1010' },
]

// ─── Photo mapping per vehicle index ─────────────────────────────────────────
const PHOTO_FOR_VEHICLE = [
  MOTO_PHOTOS.ducati,
  MOTO_PHOTOS.suzuki,
  MOTO_PHOTOS.honda_crf,
  MOTO_PHOTOS.triumph,
  MOTO_PHOTOS.yamaha_xsr,
  MOTO_PHOTOS.ktm,
  MOTO_PHOTOS.honda_crf3,
  MOTO_PHOTOS.bmw_f800,
  MOTO_PHOTOS.bmw_gs,
  MOTO_PHOTOS.yamaha_mt,
]

// ─── Job definitions (index maps to customer+vehicle above) ──────────────────
const JOB_DEFS = [
  {
    idx: 0,
    bucket: 'new_requests',   status: 'new',
    revenue_stream: 'service', logistics_type: 'drop_off', priority: 10,
    description: 'ขอใบเสนอราคาเซอร์วิสครบ 10,000 กม. / Quote request for full 10,000 km service. Customer reports vibration at highway speeds and spongy brake lever.',
  },
  {
    idx: 1,
    bucket: 'new_requests',   status: 'under_review',
    revenue_stream: 'ecu',     logistics_type: null, priority: 5,
    description: 'ขอรีแมปกล่อง Stage 2 / ECU remap request — Stage 2 tune for track day next month. Bike has aftermarket exhaust fitted.',
  },
  {
    idx: 2,
    bucket: 'intake',         status: 'awaiting_drop_off',
    revenue_stream: 'service', logistics_type: 'pickup', priority: 8,
    description: 'รับรถที่บ้านลูกค้า / Scheduled pickup from Nonthaburi. Full service + chain + front tyre swap. Morning slot requested.',
    intake_mileage: 18420,
  },
  {
    idx: 3,
    bucket: 'intake',         status: 'received_at_shop',
    revenue_stream: 'service', logistics_type: 'drop_off', priority: 6,
    description: 'รับรถแล้ว รอวินิจฉัย / Bike received. Intermittent stalling at low RPM. Suspected fuel pump issue. Awaiting diagnosis.',
    intake_mileage: 32100,
  },
  {
    idx: 4,
    bucket: 'available_jobs', status: 'awaiting_assignment',
    revenue_stream: 'service', logistics_type: 'drop_off', priority: 9,
    description: 'เซอร์วิสเครื่องยนต์ตามกำหนด / Full engine service: valve clearance, cam chain tensioner, coolant flush, spark plugs. Parts on shelf.',
    intake_mileage: 28750,
  },
  {
    idx: 5,
    bucket: 'available_jobs', status: 'awaiting_parts',
    revenue_stream: 'service', logistics_type: null, priority: 4,
    description: 'โอเวอร์ฮอลเบรค / Brake overhaul front and rear. Ordered braided lines and EBC pads — ETA 2 days.',
    intake_mileage: 41200,
  },
  {
    idx: 6,
    bucket: 'wip',           status: 'work_started',
    revenue_stream: 'service', logistics_type: 'drop_off', priority: 7,
    description: 'เปลี่ยนน้ำมัน กรอง ยางหลัง / Oil change, filter, air filter. Rear tyre swap — Continental ContiTrailAttack 3. Job started.',
    intake_mileage: 9830,
  },
  {
    idx: 7,
    bucket: 'wip',           status: 'work_started',
    revenue_stream: 'service', logistics_type: 'pickup', priority: 9,
    description: 'เปลี่ยนซีลโช้คสองข้าง / Fork seal replacement both sides — oil leaking. Handlebars and mirrors while on bench. High priority.',
    intake_mileage: 55600,
  },
  {
    idx: 8,
    bucket: 'outbound',      status: 'work_completed',
    revenue_stream: 'service', logistics_type: 'pickup', priority: 3,
    description: 'เซอร์วิสสมบูรณ์ รอส่งคืน / Full service done. Front brake pads replaced, brakes bled, throttle cable adjusted. Ready for driver pickup.',
    intake_mileage: 62300,
  },
  {
    idx: 9,
    bucket: 'outbound',      status: 'awaiting_pickup',
    revenue_stream: 'ecu',    logistics_type: 'drop_off', priority: 2,
    description: 'แฟลช ECU สำเร็จ / ECU flash complete. Stage 1 map loaded, dyno tested — +8hp at peak. Customer notified, collecting tomorrow.',
    intake_mileage: 14900,
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 BGOP Dummy Data Seed\n')

  // 1. Clear existing test data (jobs, then customers+vehicles cascade)
  console.log('🧹 Clearing old seed data...')
  await supabase.from('jobs').delete().like('description', '%[SEED]%')
  const { data: oldCustomers } = await supabase.from('customers').select('id').like('phone', '+66-81-001-00%')
  if (oldCustomers?.length) {
    const ids = oldCustomers.map(c => c.id)
    await supabase.from('vehicles').delete().in('customer_id', ids)
    await supabase.from('customers').delete().in('id', ids)
  }
  console.log('   ✅ Cleared\n')

  // 2. Insert customers
  console.log('👥 Creating customers...')
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .insert(CUSTOMERS.map(c => ({ ...c, consent_to_message: true, dormant: false, acquisition_source: 'walk_in' })))
    .select('id, full_name')
  if (cErr) { console.error('❌ Customers:', cErr.message); process.exit(1) }
  console.log(`   ✅ ${customers.length} customers created\n`)

  // 3. Insert vehicles (one per customer)
  console.log('🏍️  Creating vehicles...')
  const vehicleRows = VEHICLES.map((v, i) => ({
    ...v,
    customer_id: customers[i].id,
    ownership_status: 'customer_owned',
  }))
  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .insert(vehicleRows)
    .select('id')
  if (vErr) { console.error('❌ Vehicles:', vErr.message); process.exit(1) }
  console.log(`   ✅ ${vehicles.length} vehicles created\n`)

  // 4. Insert jobs with photos
  console.log('🔧 Creating jobs with photos...\n')
  let jobsCreated = 0
  for (const def of JOB_DEFS) {
    const customer = customers[def.idx]
    const vehicle = vehicles[def.idx]
    const photo = PHOTO_FOR_VEHICLE[def.idx]

    const jobPayload = {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      bucket: def.bucket,
      status: def.status,
      revenue_stream: def.revenue_stream,
      logistics_type: def.logistics_type ?? null,
      description: def.description,
      intake_mileage: def.intake_mileage ?? null,
      priority: def.priority ?? 0,
      intake_photos: [photo],
      owner_notify_threshold_thb: 2000,
    }

    const { error: jErr } = await supabase.from('jobs').insert(jobPayload)
    if (jErr) {
      console.error(`  ❌ Job for ${customer.full_name}: ${jErr.message}`)
    } else {
      const bucket = def.bucket.replace(/_/g, ' ').toUpperCase()
      console.log(`  ✅ [${bucket}] ${customer.full_name} — ${VEHICLES[def.idx].make} ${VEHICLES[def.idx].model}`)
      jobsCreated++
    }
  }

  console.log(`\n✅ Seed complete! ${jobsCreated}/10 jobs created with photos.`)
  console.log('\n📋 Next steps:')
  console.log('   1. Create an owner account in Supabase Auth dashboard')
  console.log('      → https://supabase.com/dashboard/project/ugmbbcjxvvyadtahetgt/auth/users')
  console.log('   2. Add app_metadata: { "role": "owner" } to that user')
  console.log('   3. Run: npm run dev')
  console.log('   4. Open http://localhost:3000 and log in\n')
}

main().catch(err => { console.error(err); process.exit(1) })
