// ============================================================
// BGOP Domain Types — matches database schema exactly
// ============================================================

export type UserRole = 'owner' | 'pa' | 'mechanic' | 'driver'
export type Language = 'en' | 'th'

export type AcquisitionSource =
  | 'word_of_mouth'
  | 'seo'
  | 'chatgpt'
  | 'walk_in'
  | 'referral'
  | 'social_media'
  | 'repeat'
  | 'other'

export type RevenueStream =
  | 'service'
  | 'transport'
  | 'dlt'
  | 'sourcing'
  | 'commission'
  | 'ecu'
  | 'track_day'
  | 'bike_hotel'

export type Bucket =
  | 'new_requests'
  | 'intake'
  | 'available_jobs'
  | 'wip'
  | 'outbound'

export type JobStatus =
  // new_requests bucket
  | 'new'
  | 'under_review'
  | 'awaiting_customer'
  | 'quote_sent'
  | 'confirmed'
  // intake bucket
  | 'awaiting_drop_off'
  | 'driver_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'received_at_shop'
  // available_jobs bucket
  | 'awaiting_assignment'
  | 'awaiting_parts'
  | 'awaiting_approval'
  // wip bucket
  | 'work_started'
  | 'paused_parts'
  | 'paused_approval'
  | 'work_completed'
  // outbound bucket
  | 'awaiting_pickup'
  | 'driver_assigned_delivery'
  | 'out_for_delivery'
  | 'returned_to_customer'
  // terminal
  | 'withdrawn'
  | 'rejected'
  | 'archived'

export type LogisticsType = 'drop_off' | 'pickup'
export type OwnershipStatus = 'customer_owned' | 'for_sale' | 'for_rent'
export type ProductCategory = 'parts' | 'labour' | 'service_package'
export type ProductUnit = 'each' | 'hour' | 'set' | 'litre' | 'metre'
export type LineType = 'labour' | 'part'
export type InvoiceStatus =
  | 'quote'
  | 'pending_owner_approval'
  | 'owner_declined'
  | 'approved'
  | 'deposit_paid'
  | 'pending'
  | 'paid'
  | 'void'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'promptpay' | 'credit_card' | 'other'
export type ScopeChangeStatus = 'flagged' | 'pending' | 'approved' | 'declined'
export type DriverOrderType = 'pickup' | 'delivery'
export type DriverOrderStatus =
  | 'pending'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'loaded'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
export type MessageStatus = 'sent' | 'failed' | 'delivered'
export type ReminderType = 'service' | 'ar'
export type DiscountType = 'percent' | 'fixed'
export type DiscountApplicableTo = 'all' | 'labour' | 'parts' | 'service_package' | 'specific_streams'
export type VehicleReminderDecision = 'sent' | 'skipped'
export type VehicleReminderType = '90_day' | '180_day'

// ============================================================
// Entity types
// ============================================================

export interface Customer {
  id: string
  full_name: string
  phone: string | null
  line_id: string | null
  email: string | null
  nationality: string | null
  preferred_language: Language
  consent_to_message: boolean
  acquisition_source: AcquisitionSource | null
  related_customer_id: string | null
  notes: string | null
  dormant: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  full_name: string
  role: UserRole
  preferred_language: Language
  line_id: string | null
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  customer_id: string
  make: string
  model: string
  year: number
  vin: string | null
  engine_number: string | null
  color: string | null
  license_plate: string | null
  ownership_status: OwnershipStatus
  last_service_date: string | null
  last_service_mileage: number | null
  current_mileage: number | null
  primary_photo_url: string | null   // F1
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  sku: string
  name: string           // Bilingual: 'Thai / English'
  description: string | null
  category: ProductCategory
  subcategory: string | null
  cost_price: number | null  // NULL only for legacy imports
  sale_price: number
  unit: ProductUnit
  active: boolean
  created_at: string
  updated_at: string
}

export interface JobTemplate {
  id: string
  name: string           // Bilingual: 'Thai / English'
  description: string | null
  revenue_stream: RevenueStream
  estimated_duration_hours: number | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface JobTemplateItem {
  id: string
  template_id: string
  product_id: string | null
  line_type: LineType
  description: string    // Bilingual
  quantity: number
  sort_order: number
  created_at: string
}

export interface Job {
  id: string
  customer_id: string
  vehicle_id: string
  mechanic_id: string | null
  template_id: string | null
  bucket: Bucket
  status: JobStatus
  priority: number
  logistics_type: LogisticsType | null
  revenue_stream: RevenueStream | null
  description: string    // Bilingual delimiter format
  mechanic_notes: string | null
  intake_mileage: number | null
  completion_mileage: number | null
  intake_photos: string[] | null
  mechanic_photos: string[] | null   // F1
  owner_notify_threshold_thb: number
  created_at: string
  updated_at: string
  completed_at: string | null
  archived_at: string | null
}

export interface JobStatusHistory {
  id: string
  job_id: string
  from_bucket: Bucket | null
  from_status: JobStatus | null
  to_bucket: Bucket
  to_status: JobStatus
  changed_by: string | null
  changed_at: string
  notes: string | null
}

export interface JobLineItem {
  id: string
  job_id: string
  product_id: string | null
  line_type: LineType
  description: string
  sku: string | null
  quantity: number
  cost_price: number | null
  sale_price: number
  cost_estimated: boolean
  dlt_passthrough: boolean
  is_scope_change: boolean
  scope_approved_at: string | null
  // F4 — Discounts
  discount_id: string | null
  discount_applied_value: number | null
  // F6 — Mechanic checklist
  mechanic_completed: boolean
  mechanic_completed_at: string | null
  mechanic_completed_by: string | null
  created_at: string
}

export interface Invoice {
  id: string
  job_id: string | null
  customer_id: string
  vehicle_id: string | null
  revenue_stream: RevenueStream
  invoice_number: string | null
  invoice_date: string
  status: InvoiceStatus
  total_amount: number
  deposit_amount: number | null
  deposit_paid_at: string | null
  paid_amount: number | null
  payment_method: PaymentMethod | null
  paid_at: string | null
  notes: string | null
  // F5 — Owner approval
  submitted_for_approval_at: string | null
  approved_by: string | null
  approved_at: string | null
  owner_decline_reason: string | null
  created_at: string
  updated_at: string
}

export interface ScopeChange {
  id: string
  job_id: string
  flagged_by: string | null
  entered_by: string | null
  description: string
  mechanic_notes: string | null
  amount_thb: number
  status: ScopeChangeStatus
  customer_response_at: string | null
  created_at: string
}

export interface DriverWorkOrder {
  id: string
  job_id: string
  driver_id: string | null
  order_type: DriverOrderType
  status: DriverOrderStatus
  pickup_address: string | null
  delivery_address: string | null
  scheduled_date: string | null
  notes: string | null
  // F1 — Photo completion flags
  pickup_photos_complete: boolean
  delivery_photos_complete: boolean
  created_at: string
  updated_at: string
}

export interface MessageLog {
  id: string
  customer_id: string | null
  job_id: string | null
  channel: string
  message_type: string
  content: string | null
  sent_at: string
  status: MessageStatus
}

export interface ReminderLog {
  id: string
  vehicle_id: string | null
  customer_id: string | null
  channel: string
  sent_at: string
  reminder_type: ReminderType
}

// F4 — Discounts Module
export interface Discount {
  id: string
  name: string                            // Bilingual: 'Thai / English'
  description: string | null
  discount_type: DiscountType
  discount_value: number
  applicable_to: DiscountApplicableTo
  applicable_streams: string[] | null
  min_invoice_amount: number | null
  max_discount_amount: number | null
  preapproved: boolean
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// F3 — Vehicle Reminder Log
export interface VehicleReminderLog {
  id: string
  vehicle_id: string
  customer_id: string
  reminder_type: VehicleReminderType
  eligible_since: string
  reviewed_by: string | null
  reviewed_at: string | null
  decision: VehicleReminderDecision | null
  sent_at: string | null
  channel: string
  message_content: string | null
  created_at: string
  // Joined relations (when fetched with joins)
  vehicle?: {
    make: string
    model: string
    year: number
    color: string | null
    primary_photo_url: string | null
    last_service_date: string | null
  }
  customer?: {
    full_name: string
    line_id: string | null
    preferred_language: string | null
  }
}

export interface Expense {
  id: string
  category: string
  amount: number
  date: string
  description: string | null
  vendor: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Enriched types (with joins)
// ============================================================

export interface JobWithRelations extends Job {
  customer: Customer
  vehicle: Vehicle
  mechanic: User | null
  line_items: JobLineItem[]
  status_history: JobStatusHistory[]
  scope_changes: ScopeChange[]
  invoice: Invoice | null
}

export interface CustomerWithVehicles extends Customer {
  vehicles: Vehicle[]
}

export interface JobTemplateWithItems extends JobTemplate {
  items: (JobTemplateItem & { product: Product | null })[]
}

// ============================================================
// Supabase Database type (for typed client)
// ============================================================

export type Database = {
  public: {
    Tables: {
      customers: { Row: Customer; Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Customer, 'id'>> }
      users: { Row: User; Insert: Omit<User, 'created_at' | 'updated_at'>; Update: Partial<Omit<User, 'id'>> }
      vehicles: { Row: Vehicle; Insert: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Vehicle, 'id'>> }
      products: { Row: Product; Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Product, 'id'>> }
      job_templates: { Row: JobTemplate; Insert: Omit<JobTemplate, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<JobTemplate, 'id'>> }
      job_template_items: { Row: JobTemplateItem; Insert: Omit<JobTemplateItem, 'id' | 'created_at'>; Update: Partial<Omit<JobTemplateItem, 'id'>> }
      jobs: { Row: Job; Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Job, 'id'>> }
      job_status_history: { Row: JobStatusHistory; Insert: Omit<JobStatusHistory, 'id' | 'changed_at'>; Update: never }
      job_line_items: { Row: JobLineItem; Insert: Omit<JobLineItem, 'id' | 'created_at'>; Update: Partial<Omit<JobLineItem, 'id'>> }
      invoices: { Row: Invoice; Insert: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Invoice, 'id'>> }
      scope_changes: { Row: ScopeChange; Insert: Omit<ScopeChange, 'id' | 'created_at'>; Update: Partial<Omit<ScopeChange, 'id'>> }
      driver_work_orders: { Row: DriverWorkOrder; Insert: Omit<DriverWorkOrder, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<DriverWorkOrder, 'id'>> }
      message_log: { Row: MessageLog; Insert: Omit<MessageLog, 'id' | 'sent_at'>; Update: never }
      reminder_log: { Row: ReminderLog; Insert: Omit<ReminderLog, 'id' | 'sent_at'>; Update: never }
      expenses: { Row: Expense; Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Expense, 'id'>> }
      discounts: { Row: Discount; Insert: Omit<Discount, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Discount, 'id'>> }
      vehicle_reminder_log: { Row: VehicleReminderLog; Insert: Omit<VehicleReminderLog, 'id' | 'created_at'>; Update: Partial<Omit<VehicleReminderLog, 'id'>> }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
