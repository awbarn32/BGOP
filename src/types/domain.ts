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
export type InvoiceStatus = 'quote' | 'approved' | 'deposit_paid' | 'pending' | 'paid' | 'void'
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

// ============================================================
// Entity types
// ============================================================

export interface Customer {
  id: string
  full_name: string
  phone: string | null
  line_id: string | null
  line_display_name: string | null
  line_picture_url: string | null
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

export interface ConversationThread {
  id: string
  channel: string
  line_user_id: string | null
  customer_id: string | null
  active_job_id: string | null
  latest_message_at: string | null
  latest_message_preview: string | null
  last_inbound_at: string | null
  last_outbound_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound' | 'system'
  sender_role: string | null
  message_type: string
  body_text: string | null
  delivery_status: string
  sent_by_user_id: string | null
  sent_at: string
  created_at: string
}

export interface ConversationMessageLocalization {
  message_id: string
  source_language: 'th' | 'en' | 'unknown'
  text_en: string | null
  text_th: string | null
  model: string | null
  prompt_version: string | null
  translated_at: string
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  estimated_cost_usd: number
  created_at: string
  updated_at: string
}

export interface ConversationThreadAiState {
  thread_id: string
  summary_json: Record<string, unknown>
  last_summarized_message_id: string | null
  summarized_message_count: number
  model: string | null
  prompt_version: string | null
  created_at: string
  updated_at: string
}

export interface ConversationAiRun {
  id: string
  thread_id: string | null
  message_id: string | null
  feature: 'translation' | 'summary' | 'reply_draft'
  status: 'success' | 'error'
  model: string | null
  prompt_version: string | null
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  estimated_cost_usd: number
  error_message: string | null
  created_at: string
}

export interface ConversationThreadUserState {
  thread_id: string
  user_id: string
  last_read_message_id: string | null
  last_read_at: string | null
  is_resolved: boolean
  resolved_at: string | null
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
      conversation_threads: { Row: ConversationThread; Insert: Omit<ConversationThread, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ConversationThread, 'id' | 'created_at'>> }
      conversation_messages: { Row: ConversationMessage; Insert: Omit<ConversationMessage, 'id' | 'created_at' | 'sent_at'>; Update: Partial<Omit<ConversationMessage, 'id' | 'created_at' | 'thread_id'>> }
      conversation_message_localizations: { Row: ConversationMessageLocalization; Insert: Omit<ConversationMessageLocalization, 'created_at' | 'updated_at'>; Update: Partial<Omit<ConversationMessageLocalization, 'message_id' | 'created_at'>> }
      conversation_thread_ai_state: { Row: ConversationThreadAiState; Insert: Omit<ConversationThreadAiState, 'created_at' | 'updated_at'>; Update: Partial<Omit<ConversationThreadAiState, 'thread_id' | 'created_at'>> }
      conversation_ai_runs: { Row: ConversationAiRun; Insert: Omit<ConversationAiRun, 'id' | 'created_at'>; Update: never }
      conversation_thread_user_state: { Row: ConversationThreadUserState; Insert: ConversationThreadUserState; Update: Partial<ConversationThreadUserState> }
      line_webhook_events: { Row: { id: string; webhook_event_id: string; processed_at: string }; Insert: Omit<{ id: string; webhook_event_id: string; processed_at: string }, 'id' | 'processed_at'>; Update: never }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
