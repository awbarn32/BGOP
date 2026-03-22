-- ============================================================
-- BGOP Migration 007 — Addendum v3.3
-- Apply AFTER confirming 006 is live in Supabase.
-- Run as: supabase db push (or paste into Supabase SQL editor)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- F1: Photo System — schema changes
-- ─────────────────────────────────────────────────────────────

-- Vehicle primary reference photo (one per vehicle)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS primary_photo_url TEXT;

-- Driver work order photo completion flags
ALTER TABLE public.driver_work_orders
  ADD COLUMN IF NOT EXISTS pickup_photos_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_photos_complete BOOLEAN NOT NULL DEFAULT false;

-- Mechanic job photos (array of Storage URLs, appended not replaced)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS mechanic_photos TEXT[];

-- ─────────────────────────────────────────────────────────────
-- F4: Discounts Module — new table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  discount_type       VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value      NUMERIC(10,2) NOT NULL,
  applicable_to       VARCHAR(20) NOT NULL CHECK (applicable_to IN (
                        'all', 'labour', 'parts', 'service_package', 'specific_streams'
                      )),
  applicable_streams  TEXT[],
  min_invoice_amount  NUMERIC(10,2),
  max_discount_amount NUMERIC(10,2),
  preapproved         BOOLEAN NOT NULL DEFAULT false,
  active              BOOLEAN NOT NULL DEFAULT true,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discounts_active      ON public.discounts(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_discounts_preapproved ON public.discounts(preapproved);

CREATE TRIGGER discounts_set_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- RLS for discounts
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discounts_owner_manage" ON public.discounts;
DROP POLICY IF EXISTS "discounts_pa_read" ON public.discounts;

CREATE POLICY "discounts_owner_manage" ON public.discounts
  FOR ALL USING (public.get_user_role() = 'owner')
  WITH CHECK (public.get_user_role() = 'owner');

CREATE POLICY "discounts_pa_read" ON public.discounts
  FOR SELECT USING (public.is_owner_or_pa());

-- ─────────────────────────────────────────────────────────────
-- F4: Discounts — job_line_items additions
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.job_line_items
  ADD COLUMN IF NOT EXISTS discount_id            UUID REFERENCES public.discounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_applied_value NUMERIC(10,2);

-- ─────────────────────────────────────────────────────────────
-- F5: Owner Approval Workflow — invoice status expansion
-- ─────────────────────────────────────────────────────────────

-- Drop and recreate the status CHECK to add new values
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'quote',
    'pending_owner_approval',
    'owner_declined',
    'approved',
    'deposit_paid',
    'pending',
    'paid',
    'void'
  ));

-- New approval-tracking columns on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by               UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_decline_reason      TEXT;

-- ─────────────────────────────────────────────────────────────
-- F6: Mechanic Work Order Checklist — job_line_items additions
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.job_line_items
  ADD COLUMN IF NOT EXISTS mechanic_completed     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mechanic_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mechanic_completed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- RLS: mechanic can update completion fields on their assigned jobs
-- (relies on existing is_mechanic_for_job() function from earlier migrations)
DROP POLICY IF EXISTS "line_items_mechanic_complete" ON public.job_line_items;

DO $$
BEGIN
  -- Only create the policy if the helper function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_mechanic_for_job'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "line_items_mechanic_complete" ON public.job_line_items
        FOR UPDATE
        USING (
          public.get_user_role() = 'mechanic'
          AND public.is_mechanic_for_job(job_id)
        )
        WITH CHECK (
          public.get_user_role() = 'mechanic'
          AND public.is_mechanic_for_job(job_id)
        )
    $policy$;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- F3: Service Reminders — new vehicle_reminder_log table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicle_reminder_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reminder_type   VARCHAR(10) NOT NULL CHECK (reminder_type IN ('90_day', '180_day')),
  eligible_since  DATE NOT NULL,
  reviewed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  decision        VARCHAR(10) CHECK (decision IN ('sent', 'skipped')),
  sent_at         TIMESTAMPTZ,
  channel         VARCHAR(10) NOT NULL DEFAULT 'line',
  message_content TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_reminder_log_vehicle
  ON public.vehicle_reminder_log(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_reminder_log_type
  ON public.vehicle_reminder_log(reminder_type, sent_at);

-- RLS for vehicle_reminder_log
ALTER TABLE public.vehicle_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_log_owner_pa" ON public.vehicle_reminder_log;

CREATE POLICY "reminder_log_owner_pa" ON public.vehicle_reminder_log
  FOR ALL
  USING (public.is_owner_or_pa())
  WITH CHECK (public.is_owner_or_pa());

-- ─────────────────────────────────────────────────────────────
-- Storage bucket paths (reference — create via Supabase dashboard)
-- ─────────────────────────────────────────────────────────────
-- Bucket: bgop-photos (public read, authenticated write)
-- Paths:
--   vehicles/{vehicle_id}/primary.jpg
--   intake/{job_id}/{uuid}.jpg
--   driver/pickup/{work_order_id}/left.jpg
--   driver/pickup/{work_order_id}/right.jpg
--   driver/pickup/{work_order_id}/loaded.jpg
--   driver/delivery/{work_order_id}/left.jpg
--   driver/delivery/{work_order_id}/right.jpg
--   driver/delivery/{work_order_id}/dropoff.jpg
--   mechanic/{job_id}/{uuid}.jpg
