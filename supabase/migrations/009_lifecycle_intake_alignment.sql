-- ============================================================
-- BGOP Migration 009: Lifecycle + intake alignment
-- ============================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_address TEXT;

ALTER TABLE public.scope_changes
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pa_notes TEXT;
