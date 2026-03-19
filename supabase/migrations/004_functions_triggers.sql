-- ============================================================
-- BGOP Migration 004: Functions and Triggers
-- ============================================================

-- ============================================================
-- Role helper functions (used in RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'mechanic');
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_pa()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT public.get_user_role() IN ('owner', 'pa');
$$;

CREATE OR REPLACE FUNCTION public.is_mechanic_for_job(job_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = job_uuid AND mechanic_id = auth.uid()
  );
$$;

-- ============================================================
-- Auto-update timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER vehicles_set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER driver_work_orders_set_updated_at
  BEFORE UPDATE ON public.driver_work_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER job_templates_set_updated_at
  BEFORE UPDATE ON public.job_templates
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ============================================================
-- Job status history — auto-record via trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_job_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.job_status_history (job_id, to_bucket, to_status)
    VALUES (NEW.id, NEW.bucket, NEW.status);
  ELSIF (OLD.bucket IS DISTINCT FROM NEW.bucket OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.job_status_history (
      job_id, from_bucket, from_status, to_bucket, to_status
    ) VALUES (
      NEW.id, OLD.bucket, OLD.status, NEW.bucket, NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_record_status_change
  AFTER INSERT OR UPDATE OF bucket, status ON public.jobs
  FOR EACH ROW EXECUTE PROCEDURE public.record_job_status_change();

-- ============================================================
-- Auth user sync — creates/updates public.users on auth.users insert/update
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role, preferred_language, line_id)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    coalesce(NEW.raw_app_meta_data ->> 'role', 'mechanic'),
    coalesce(NEW.raw_user_meta_data ->> 'preferred_language', 'th'),
    NEW.raw_user_meta_data ->> 'line_id'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      preferred_language = EXCLUDED.preferred_language,
      line_id = EXCLUDED.line_id,
      updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_sync();

-- ============================================================
-- Invoice number auto-generation (format: BG-YYYY-NNNN)
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.invoice_number IS NULL THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)), 0
    ) + 1
    INTO next_num
    FROM public.invoices
    WHERE invoice_number LIKE 'BG-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%';

    NEW.invoice_number := 'BG-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-'
      || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_generate_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE PROCEDURE public.generate_invoice_number();

-- ============================================================
-- Dormant customer marking (called by CRON edge function)
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_dormant_customers(cutoff_date DATE)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.customers
  SET dormant = true, updated_at = now()
  WHERE id IN (
    SELECT c.id
    FROM public.customers c
    LEFT JOIN public.jobs j ON j.customer_id = c.id
    LEFT JOIN public.invoices i ON i.customer_id = c.id
    GROUP BY c.id
    HAVING
      coalesce(max(j.created_at::date), date '1900-01-01') <= cutoff_date
      AND coalesce(max(i.invoice_date), date '1900-01-01') <= cutoff_date
  );
$$;
