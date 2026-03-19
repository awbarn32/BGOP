/**
 * BGOP Demo Data Import Script
 * Imports customers, vehicles, and products from source files into Supabase.
 * Real customer/vehicle/product data is imported cleanly.
 * Run: node scripts/import-demo-data.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const xlsx = require('xlsx')

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ugmbbcjxvvyadtahetgt.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbWJiY2p4dnZ5YWR0YWhldGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg4MjU4NSwiZXhwIjoyMDg5NDU4NTg1fQ.S9RxrnDHB7bb5gWv4S_LChrD0ukRBfFZr36Fnml3PXU'

const CUSTOMERS_CSV = 'C:/Users/Andy/OneDrive/Antigravity Workspaces/Garage Files/Invoices and Customer History/Customers_Clean.csv'
const MOTORCYCLES_CSV = 'C:/Users/Andy/OneDrive/Antigravity Workspaces/Garage Files/Invoices and Customer History/Motorcycles_Clean.csv'
const PRODUCTS_XLSX = 'C:/Users/Andy/OneDrive/Antigravity Workspaces/Garage Build/Master Product Reference v2.xlsx'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '') // strip BOM
  const lines = raw.split('\n').filter(l => l.trim())
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function normaliseMake(raw) {
  const s = (raw || '').toLowerCase().trim()
  if (s.includes('honda'))        return 'honda'
  if (s.includes('yamah'))        return 'yamaha'
  if (s.includes('kawas'))        return 'kawasaki'
  if (s.includes('suzuki'))       return 'suzuki'
  if (s.includes('ducati'))       return 'ducati'
  if (s.includes('bmw'))          return 'bmw'
  if (s.includes('triumph'))      return 'triumph'
  if (s.includes('ktm'))          return 'ktm'
  if (s.includes('royal') || s.includes('enfield')) return 'royal_enfield'
  if (s.includes('harley'))       return 'harley_davidson'
  if (s.includes('aprilia'))      return 'aprilia'
  if (s.includes('husqvarna') || s.includes('husky')) return 'husqvarna'
  if (s.includes('benelli'))      return 'benelli'
  if (s.includes('cfmoto'))       return 'cfmoto'
  return 'other'
}

function mapPaymentCodeToCategory(code) {
  // L = Labour, P = Parts, T = Transport/Service package
  if (code === 'L') return 'labour'
  if (code === 'P') return 'parts'
  if (code === 'T') return 'service_package'
  return 'parts' // default
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── 1. Import Customers ─────────────────────────────────────────────────────
async function importCustomers() {
  console.log('\n📋 Importing customers...')
  const rows = parseCSV(CUSTOMERS_CSV)
  console.log(`   Found ${rows.length} customers in CSV`)

  // Build map: CUST-XXXX → Supabase UUID
  const custIdMap = {}

  const records = rows
    .filter(r => r.Customer_Name?.trim())
    .map(r => {
      // Combine address + ID number into notes since there's no address column
      const noteParts = []
      if (r.Current_Address?.trim()) noteParts.push(r.Current_Address.trim())
      if (r.ID_Number?.trim()) noteParts.push(`ID: ${r.ID_Number.trim()}`)
      return {
        full_name: r.Customer_Name.trim(),
        phone: r.Current_Phone_Number?.trim().slice(0, 20) || null,
        email: r.Current_Email?.trim() || null,
        notes: noteParts.length ? noteParts.join(' | ') : null,
        acquisition_source: 'other',
        preferred_language: 'en',
        dormant: false,
        consent_to_message: true,
        _source_id: r.Customer_ID,
      }
    })

  // Fetch already-inserted names to avoid duplicates (no unique constraint on full_name)
  const { data: existing } = await supabase.from('customers').select('id, full_name')
  const existingNames = new Set((existing || []).map(c => c.full_name))
  // Pre-populate custIdMap with already-existing customers
  ;(existing || []).forEach(c => {
    const match = records.find(r => r.full_name === c.full_name)
    if (match) custIdMap[match._source_id] = c.id
  })
  const toInsert = records.filter(r => !existingNames.has(r.full_name))
  console.log(`   Already in DB: ${existingNames.size}, to insert: ${toInsert.length}`)

  // Insert in batches of 50
  let inserted = 0
  for (const batch of chunk(toInsert, 50)) {
    const dbRows = batch.map(({ _source_id, ...rest }) => rest)
    const { data, error } = await supabase
      .from('customers')
      .insert(dbRows)
      .select('id, full_name')

    if (error) {
      console.error('   ❌ Customer batch error:', error.message)
      continue
    }

    // Map source IDs to new UUIDs by matching name (order preserved)
    data.forEach((row, i) => {
      custIdMap[batch[i]._source_id] = row.id
    })

    inserted += data.length
  }

  console.log(`   ✅ Inserted ${inserted} customers`)
  return custIdMap
}

// ─── 2. Import Vehicles ───────────────────────────────────────────────────────
async function importVehicles(custIdMap) {
  console.log('\n🏍️  Importing vehicles...')
  const rows = parseCSV(MOTORCYCLES_CSV)
  console.log(`   Found ${rows.length} motorcycles in CSV`)

  // Check how many vehicles already exist
  const { count } = await supabase.from('vehicles').select('id', { count: 'exact', head: true })
  if (count && count >= rows.length) {
    console.log(`   ✅ Vehicles already imported (${count} in DB), skipping`)
    return
  }

  const records = rows
    .filter(r => r.Owner_Customer_ID && r.Make_Brand)
    .map(r => {
      const customerId = custIdMap[r.Owner_Customer_ID]
      if (!customerId) return null
      return {
        customer_id: customerId,
        make: normaliseMake(r.Make_Brand),
        model: r.Model?.trim() || 'Unknown',
        license_plate: r.License_Plate?.trim() || null,
        year: 2020, // CSV has no year data; placeholder for demo
        color: null,
        vin: null,
        engine_number: null,
        current_mileage: null,
        last_service_date: null,
        ownership_status: 'customer_owned',
      }
    })
    .filter(Boolean)

  let inserted = 0
  for (const batch of chunk(records, 50)) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(batch)
      .select('id')
      // vehicles have no unique constraint to upsert on, so just insert new ones

    if (error) {
      console.error('   ❌ Vehicle batch error:', error.message)
      continue
    }
    inserted += data.length
  }

  console.log(`   ✅ Inserted ${inserted} vehicles`)
}

// ─── 3. Import Products ───────────────────────────────────────────────────────
async function importProducts() {
  console.log('\n📦 Importing products...')
  const wb = xlsx.readFile(PRODUCTS_XLSX)
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Products Master'])
  console.log(`   Found ${rows.length} product rows in Excel`)

  // Deduplicate by description (case-insensitive), keep highest price
  const seen = new Map()
  for (const r of rows) {
    const desc = (r['Description'] || '').trim()
    if (!desc) continue
    const key = desc.toLowerCase()
    const price = Number(r['Standard Price']) || 0
    const existing = seen.get(key)
    if (!existing || price > existing.price) {
      seen.set(key, {
        name: desc,
        sku: r['SKU']?.trim() || null,
        price,
        code: r['Payment Code']?.trim() || '',
      })
    }
  }

  console.log(`   After dedup: ${seen.size} unique products`)

  const records = [...seen.values()].map((r, i) => ({
    name: r.name,
    // Generate sequential SKU if none exists; SKU is NOT NULL UNIQUE in DB
    sku: r.sku || `IMP-${String(i + 1).padStart(4, '0')}`,
    sale_price: r.price,
    cost_price: null,
    category: mapPaymentCodeToCategory(r.code),
    subcategory: null,
    active: true,
  }))

  let inserted = 0
  for (const batch of chunk(records, 100)) {
    const { data, error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'sku', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('   ❌ Product batch error:', error.message)
      continue
    }
    inserted += data.length
  }

  console.log(`   ✅ Inserted ${inserted} products`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 BGOP Demo Data Import')
  console.log('========================')

  try {
    const custIdMap = await importCustomers()
    await importVehicles(custIdMap)
    await importProducts()
    console.log('\n✅ Import complete!')
  } catch (err) {
    console.error('\n❌ Fatal error:', err)
    process.exit(1)
  }
}

main()
