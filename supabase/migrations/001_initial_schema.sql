-- ============================================================
-- BGOP Migration 001: Initial Schema
-- Butler Garage Operations Platform v3.1
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  line_id VARCHAR(100) UNIQUE,
  email VARCHAR(255),
  nationality VARCHAR(50),
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'th',
  consent_to_message BOOLEAN NOT NULL DEFAULT false,
  acquisition_source VARCHAR(30) CHECK (acquisition_source IN (
    'word_of_mouth', 'seo', 'chatgpt', 'walk_in', 'referral', 'social_media', 'repeat', 'other'
  )),
  related_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  notes TEXT,
  dormant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- users (staff — synced from Supabase Auth)
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'pa', 'mechanic', 'driver')),
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'th',
  line_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- vehicles
-- ============================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  vin VARCHAR(50) UNIQUE,
  engine_number VARCHAR(50),
  color VARCHAR(50),
  license_plate VARCHAR(20),
  ownership_status VARCHAR(20) NOT NULL DEFAULT 'customer_owned'
    CHECK (ownership_status IN ('customer_owned', 'for_sale', 'for_rent')),
  last_service_date DATE,
  last_service_mileage INT,
  current_mileage INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- products
-- ============================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,           -- Bilingual: 'Thai / English'
  description TEXT,                      -- Bilingual: 'Thai / English'
  category VARCHAR(50) NOT NULL
    CHECK (category IN ('parts', 'labour', 'service_package')),
  subcategory VARCHAR(50),
  cost_price NUMERIC(10,2),             -- NULL only for legacy imports
  sale_price NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'each'
    CHECK (unit IN ('each', 'hour', 'set', 'litre', 'metre')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- job_templates
-- ============================================================
CREATE TABLE public.job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,           -- Bilingual: 'Thai / English'
  description TEXT,
  revenue_stream VARCHAR(30) NOT NULL CHECK (revenue_stream IN (
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  )),
  estimated_duration_hours NUMERIC(4,1),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.job_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.job_templates(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  line_type VARCHAR(10) NOT NULL CHECK (line_type IN ('labour', 'part')),
  description VARCHAR(255) NOT NULL,    -- Bilingual
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- jobs
-- ============================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  mechanic_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.job_templates(id) ON DELETE SET NULL,

  -- Kanban fields
  bucket VARCHAR(20) NOT NULL DEFAULT 'new_requests'
    CHECK (bucket IN ('new_requests', 'intake', 'available_jobs', 'wip', 'outbound')),
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new', 'under_review', 'awaiting_customer', 'quote_sent', 'confirmed',
      'awaiting_drop_off', 'driver_assigned', 'picked_up', 'in_transit', 'received_at_shop',
      'awaiting_assignment', 'awaiting_parts', 'awaiting_approval',
      'work_started', 'paused_parts', 'paused_approval', 'work_completed',
      'awaiting_pickup', 'driver_assigned_delivery', 'out_for_delivery', 'returned_to_customer',
      'withdrawn', 'rejected', 'archived'
    )),
  priority INT NOT NULL DEFAULT 0,

  -- Logistics
  logistics_type VARCHAR(15) CHECK (logistics_type IN ('drop_off', 'pickup')),

  -- Classification
  revenue_stream VARCHAR(30) CHECK (revenue_stream IN (
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  )),

  -- Job details
  description TEXT NOT NULL,            -- Bilingual delimiter format
  mechanic_notes TEXT,
  intake_mileage INT,
  completion_mileage INT,
  intake_photos TEXT[],

  -- Thresholds
  owner_notify_threshold_thb INT NOT NULL DEFAULT 2000,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- ============================================================
-- job_status_history
-- ============================================================
CREATE TABLE public.job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_bucket VARCHAR(20),
  from_status VARCHAR(30),
  to_bucket VARCHAR(20) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- ============================================================
-- job_line_items
-- ============================================================
CREATE TABLE public.job_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  line_type VARCHAR(10) NOT NULL CHECK (line_type IN ('labour', 'part')),
  description VARCHAR(255) NOT NULL,
  sku VARCHAR(50),
  quantity NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  sale_price NUMERIC(10,2) NOT NULL,
  cost_estimated BOOLEAN NOT NULL DEFAULT false,
  dlt_passthrough BOOLEAN NOT NULL DEFAULT false,
  is_scope_change BOOLEAN NOT NULL DEFAULT false,
  scope_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- invoices
-- ============================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  revenue_stream VARCHAR(30) NOT NULL CHECK (revenue_stream IN (
    'service', 'transport', 'dlt', 'sourcing', 'commission', 'ecu', 'track_day', 'bike_hotel'
  )),
  invoice_number VARCHAR(20) UNIQUE,
  invoice_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'quote' CHECK (status IN (
    'quote', 'approved', 'deposit_paid', 'pending', 'paid', 'void'
  )),
  total_amount NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2),
  deposit_paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(10,2),
  payment_method VARCHAR(30) CHECK (payment_method IN (
    'cash', 'bank_transfer', 'promptpay', 'credit_card', 'other'
  )),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- scope_changes
-- ============================================================
CREATE TABLE public.scope_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  entered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  mechanic_notes TEXT,
  amount_thb NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'flagged'
    CHECK (status IN ('flagged', 'pending', 'approved', 'declined')),
  customer_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- driver_work_orders
-- ============================================================
CREATE TABLE public.driver_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'en_route', 'arrived', 'loaded', 'in_transit', 'delivered', 'cancelled')),
  pickup_address TEXT,
  delivery_address TEXT,
  scheduled_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- message_log
-- ============================================================
CREATE TABLE public.message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  channel VARCHAR(10) NOT NULL DEFAULT 'line',
  message_type VARCHAR(30) NOT NULL,
  content TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered'))
);

-- ============================================================
-- reminder_log
-- ============================================================
CREATE TABLE public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel VARCHAR(10) NOT NULL DEFAULT 'line',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('service', 'ar'))
);

-- ============================================================
-- expenses
-- ============================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  vendor VARCHAR(255),
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
