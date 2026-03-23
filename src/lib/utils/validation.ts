import { z } from 'zod'

// ============================================================
// Shared field schemas
// ============================================================

const uuid = z.string().uuid()
const bilingualText = z.string().min(1).max(255)
const phone = z.string().max(20).nullable().optional()
const lineId = z.string().max(100).nullable().optional()
const thbAmount = z.number().nonnegative()

// ============================================================
// Customer
// ============================================================

export const CreateCustomerSchema = z.object({
  full_name: z.string().min(1).max(255),
  phone: phone,
  line_id: lineId,
  email: z.string().email().nullable().optional(),
  nationality: z.string().max(50).nullable().optional(),
  preferred_language: z.enum(['en', 'th']).default('th'),
  consent_to_message: z.boolean().default(false),
  acquisition_source: z.enum([
    'word_of_mouth', 'seo', 'chatgpt', 'walk_in', 'referral', 'social_media', 'repeat', 'other'
  ]).nullable().optional(),
  related_customer_id: uuid.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdateCustomerSchema = CreateCustomerSchema.partial()

// ============================================================
// Vehicle
// ============================================================

export const CreateVehicleSchema = z.object({
  customer_id: uuid,
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  vin: z.string().max(50).nullable().optional(),
  engine_number: z.string().max(50).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  license_plate: z.string().max(20).nullable().optional(),
  ownership_status: z.enum(['customer_owned', 'for_sale', 'for_rent']).default('customer_owned'),
  last_service_date: z.string().date().nullable().optional(),
  last_service_mileage: z.number().int().nonnegative().nullable().optional(),
  current_mileage: z.number().int().nonnegative().nullable().optional(),
})

export const UpdateVehicleSchema = CreateVehicleSchema.partial().omit({ customer_id: true })

// ============================================================
// Product
// ============================================================

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: bilingualText,
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(['parts', 'labour', 'service_package']),
  subcategory: z.string().max(50).nullable().optional(),
  cost_price: thbAmount, // Required for new products — enforced here
  sale_price: thbAmount,
  unit: z.enum(['each', 'hour', 'set', 'litre', 'metre']).default('each'),
  active: z.boolean().default(true),
})

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  // cost_price remains optional on update (can't un-set it)
  cost_price: thbAmount.optional(),
})

// ============================================================
// Job Template
// ============================================================

export const TemplateItemSchema = z.object({
  product_id: uuid.nullable().optional(),
  line_type: z.enum(['labour', 'part']),
  description: bilingualText,
  quantity: z.number().positive().default(1),
  sort_order: z.number().int().default(0),
})

export const CreateTemplateSchema = z.object({
  name: bilingualText,
  description: z.string().max(2000).nullable().optional(),
  revenue_stream: z.enum(['service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel']),
  estimated_duration_hours: z.number().positive().nullable().optional(),
  active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  items: z.array(TemplateItemSchema).default([]),
})

export const UpdateTemplateSchema = CreateTemplateSchema.partial()

// ============================================================
// Expense
// ============================================================

export const CreateExpenseSchema = z.object({
  category: z.string().min(1).max(100),
  amount: thbAmount,
  date: z.string().date(),
  description: z.string().max(2000).nullable().optional(),
  vendor: z.string().max(255).nullable().optional(),
  receipt_url: z.string().url().nullable().optional(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

// ============================================================
// Job
// ============================================================

export const CreateJobSchema = z.object({
  customer_id: uuid,
  vehicle_id: uuid,
  mechanic_id: uuid.nullable().optional(),
  template_id: uuid.nullable().optional(),
  bucket: z.enum(['new_requests', 'intake', 'available_jobs', 'wip', 'outbound']).default('new_requests'),
  status: z.enum([
    'new', 'under_review', 'awaiting_customer', 'quote_sent', 'confirmed',
    'awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit', 'received_at_shop',
    'awaiting_assignment', 'awaiting_parts', 'awaiting_approval',
    'work_started', 'paused_parts', 'paused_approval', 'work_completed',
    'awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer',
    'withdrawn', 'rejected', 'archived',
  ]).default('new'),
  priority: z.number().int().default(0),
  logistics_type: z.enum(['drop_off', 'pickup']).nullable().optional(),
  revenue_stream: z.enum([
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  ]).nullable().optional(),
  description: z.string().min(1).max(5000),
  intake_mileage: z.number().int().nonnegative().nullable().optional(),
  owner_notify_threshold_thb: z.number().int().nonnegative().default(2000),
})

// ============================================================
// Public Intake
// ============================================================

export const CustomerIntakeSchema = z.object({
  preferred_language: z.enum(['th', 'en']),
  contact: z.object({
    full_name: z.string().min(1).max(255),
    phone: z.string().min(8).max(20),
    line_id: z.string().max(100).optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
  vehicle: z.object({
    make: z.string().min(1).max(100),
    model: z.string().min(1).max(100),
    year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
    license_plate: z.string().max(20).optional(),
  }),
  service: z.string().min(1).max(5000),
  logistics: z.enum(['drop_off', 'pickup']),
})


export const UpdateJobSchema = z.object({
  bucket: z.enum(['new_requests', 'intake', 'available_jobs', 'wip', 'outbound']).optional(),
  status: z.enum([
    'new', 'under_review', 'awaiting_customer', 'quote_sent', 'confirmed',
    'awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit', 'received_at_shop',
    'awaiting_assignment', 'awaiting_parts', 'awaiting_approval',
    'work_started', 'paused_parts', 'paused_approval', 'work_completed',
    'awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer',
    'withdrawn', 'rejected', 'archived',
  ]).optional(),
  mechanic_id: uuid.nullable().optional(),
  priority: z.number().int().optional(),
  logistics_type: z.enum(['drop_off', 'pickup']).nullable().optional(),
  revenue_stream: z.enum([
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  ]).nullable().optional(),
  description: z.string().min(1).max(5000).optional(),
  mechanic_notes: z.string().max(5000).nullable().optional(),
  intake_mileage: z.number().int().nonnegative().nullable().optional(),
  completion_mileage: z.number().int().nonnegative().nullable().optional(),
  owner_notify_threshold_thb: z.number().int().nonnegative().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  archived_at: z.string().datetime().nullable().optional(),
})

// ============================================================
// API error response helper
// ============================================================

export function validationError(message: string, details?: unknown) {
  return Response.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details,
      },
    },
    { status: 400 }
  )
}

export function notFoundError(resource: string) {
  return Response.json(
    { error: { code: 'NOT_FOUND', message: `${resource} not found` } },
    { status: 404 }
  )
}

export function unauthorizedError() {
  return Response.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  )
}

export function forbiddenError() {
  return Response.json(
    { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
    { status: 403 }
  )
}

export function serverError(message = 'Internal server error') {
  return Response.json(
    { error: { code: 'SERVER_ERROR', message } },
    { status: 500 }
  )
}
