-- ============================================================
-- BGOP Migration 006: Mechanic Time Logs, Parts Requests, Storage
-- ============================================================

-- ── mechanic_time_logs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mechanic_time_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clocked_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  clocked_out_at TIMESTAMPTZ,
  reason         VARCHAR(30) CHECK (reason IN ('working', 'completed', 'awaiting_parts', 'awaiting_approval', 'break')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_job_id      ON public.mechanic_time_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_mechanic_id ON public.mechanic_time_logs(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_open        ON public.mechanic_time_logs(mechanic_id, clocked_out_at) WHERE clocked_out_at IS NULL;

-- ── parts_requests ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parts_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'requested'
               CHECK (status IN ('requested', 'approved', 'ordered', 'received', 'declined')),
  pa_notes     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parts_req_job_id ON public.parts_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_parts_req_status ON public.parts_requests(status);

-- ── RLS policies for mechanic_time_logs ─────────────────────
ALTER TABLE public.mechanic_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mechanics see their own time logs"
  ON public.mechanic_time_logs FOR SELECT
  USING (mechanic_id = auth.uid() OR (auth.jwt() ->> 'role') IN ('owner', 'pa'));

CREATE POLICY "Mechanics insert their own time logs"
  ON public.mechanic_time_logs FOR INSERT
  WITH CHECK (mechanic_id = auth.uid());

CREATE POLICY "Mechanics update their own open sessions"
  ON public.mechanic_time_logs FOR UPDATE
  USING (mechanic_id = auth.uid() OR (auth.jwt() ->> 'role') IN ('owner', 'pa'));

-- ── RLS policies for parts_requests ──────────────────────────
ALTER TABLE public.parts_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff see all parts requests"
  ON public.parts_requests FOR SELECT
  USING (mechanic_id = auth.uid() OR (auth.jwt() ->> 'role') IN ('owner', 'pa'));

CREATE POLICY "Mechanics create parts requests"
  ON public.parts_requests FOR INSERT
  WITH CHECK (mechanic_id = auth.uid());

CREATE POLICY "PA can update parts requests"
  ON public.parts_requests FOR UPDATE
  USING ((auth.jwt() ->> 'role') IN ('owner', 'pa'));

-- ── Supabase Storage: driver-photos bucket ──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-photos',
  'driver-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driver-photos
CREATE POLICY "Authenticated users can upload driver photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-photos');

CREATE POLICY "Authenticated users can view driver photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-photos');
