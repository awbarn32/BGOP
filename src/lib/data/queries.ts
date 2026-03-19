import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Customer, Vehicle, Product, JobTemplate, Expense, User } from '@/types/domain'

// ============================================================
// Current user
// ============================================================

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as User | null
})

// ============================================================
// Staff users (mechanics, drivers — for assignment dropdowns)
// ============================================================

export const getStaffUsers = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, full_name, role')
    .in('role', ['mechanic', 'driver', 'pa', 'owner'])
    .order('full_name')
  return (data ?? []) as Pick<User, 'id' | 'full_name' | 'role'>[]
})

// ============================================================
// Customers
// ============================================================

export const getCustomers = cache(async (opts?: {
  search?: string
  dormant?: boolean
  acquisition_source?: string
  limit?: number
  offset?: number
}) => {
  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('full_name')

  if (opts?.search) {
    query = query.or(`full_name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%,email.ilike.%${opts.search}%`)
  }
  if (opts?.dormant !== undefined) {
    query = query.eq('dormant', opts.dormant)
  }
  if (opts?.acquisition_source) {
    query = query.eq('acquisition_source', opts.acquisition_source)
  }

  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { customers: (data ?? []) as Customer[], total: count ?? 0 }
})

export const getCustomerById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  return data as Customer | null
})

// ============================================================
// Vehicles
// ============================================================

export const getVehicles = cache(async (opts?: {
  customer_id?: string
  search?: string
  limit?: number
  offset?: number
}) => {
  const supabase = await createClient()
  let query = supabase
    .from('vehicles')
    .select('*, customer:customers(id, full_name, phone)', { count: 'exact' })
    .order('make')

  if (opts?.customer_id) {
    query = query.eq('customer_id', opts.customer_id)
  }
  if (opts?.search) {
    query = query.or(`make.ilike.%${opts.search}%,model.ilike.%${opts.search}%,license_plate.ilike.%${opts.search}%`)
  }

  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { vehicles: (data ?? []) as (Vehicle & { customer: Pick<Customer, 'id' | 'full_name' | 'phone'> })[], total: count ?? 0 }
})

export const getVehicleById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vehicles')
    .select('*, customer:customers(id, full_name, phone, line_id)')
    .eq('id', id)
    .single()
  return data as (Vehicle & { customer: Pick<Customer, 'id' | 'full_name' | 'phone' | 'line_id'> }) | null
})

// ============================================================
// Products
// ============================================================

export const getProducts = cache(async (opts?: {
  search?: string
  category?: string
  active?: boolean
  limit?: number
  offset?: number
}) => {
  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('name')

  if (opts?.search) {
    query = query.or(`name.ilike.%${opts.search}%,sku.ilike.%${opts.search}%,description.ilike.%${opts.search}%`)
  }
  if (opts?.category) {
    query = query.eq('category', opts.category)
  }
  if (opts?.active !== undefined) {
    query = query.eq('active', opts.active)
  } else {
    query = query.eq('active', true) // Default: only active
  }

  const limit = opts?.limit ?? 100
  const offset = opts?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { products: (data ?? []) as Product[], total: count ?? 0 }
})

export const getProductById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  return data as Product | null
})

// ============================================================
// Job Templates
// ============================================================

export const getTemplates = cache(async (activeOnly = true) => {
  const supabase = await createClient()
  let query = supabase
    .from('job_templates')
    .select('*, items:job_template_items(*, product:products(id, name, sku, sale_price, cost_price))')
    .order('sort_order')
    .order('name')

  if (activeOnly) {
    query = query.eq('active', true)
  }

  const { data } = await query
  return (data ?? []) as (JobTemplate & { items: unknown[] })[]
})

export const getTemplateById = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('job_templates')
    .select('*, items:job_template_items(*, product:products(id, name, sku, sale_price, cost_price, unit))')
    .eq('id', id)
    .single()
  return data as (JobTemplate & { items: unknown[] }) | null
})

// ============================================================
// Expenses
// ============================================================

export const getExpenses = cache(async (opts?: {
  category?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}) => {
  const supabase = await createClient()
  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })

  if (opts?.category) {
    query = query.eq('category', opts.category)
  }
  if (opts?.date_from) {
    query = query.gte('date', opts.date_from)
  }
  if (opts?.date_to) {
    query = query.lte('date', opts.date_to)
  }

  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count } = await query
  return { expenses: (data ?? []) as Expense[], total: count ?? 0 }
})
