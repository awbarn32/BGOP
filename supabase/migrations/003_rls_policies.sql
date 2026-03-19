-- ============================================================
-- BGOP Migration 003: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_template_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE POLICY "customers_owner_pa" ON public.customers FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "customers_mechanic_read" ON public.customers FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND id IN (
    SELECT customer_id FROM public.jobs WHERE mechanic_id = auth.uid()
  ));

-- ============================================================
-- USERS
-- ============================================================
CREATE POLICY "users_read_self_or_owner_pa" ON public.users FOR SELECT
  USING (public.is_owner_or_pa() OR id = auth.uid());

CREATE POLICY "users_owner_manage" ON public.users FOR ALL
  USING (public.get_user_role() = 'owner') WITH CHECK (public.get_user_role() = 'owner');

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE POLICY "vehicles_owner_pa" ON public.vehicles FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "vehicles_mechanic_read" ON public.vehicles FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.vehicle_id = vehicles.id AND jobs.mechanic_id = auth.uid()
  ));

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE POLICY "products_owner_pa" ON public.products FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "products_staff_read" ON public.products FOR SELECT
  USING (public.get_user_role() IN ('mechanic', 'driver'));

-- ============================================================
-- JOB_TEMPLATES
-- ============================================================
CREATE POLICY "templates_owner_pa" ON public.job_templates FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "templates_all_read" ON public.job_templates FOR SELECT
  USING (true);

CREATE POLICY "template_items_owner_pa" ON public.job_template_items FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "template_items_all_read" ON public.job_template_items FOR SELECT
  USING (true);

-- ============================================================
-- JOBS
-- ============================================================
CREATE POLICY "jobs_owner_pa" ON public.jobs FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "jobs_mechanic_read" ON public.jobs FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND mechanic_id = auth.uid());

CREATE POLICY "jobs_mechanic_update" ON public.jobs FOR UPDATE
  USING (public.get_user_role() = 'mechanic' AND mechanic_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'mechanic' AND mechanic_id = auth.uid());

CREATE POLICY "jobs_driver_read" ON public.jobs FOR SELECT
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.driver_work_orders
    WHERE job_id = jobs.id AND driver_id = auth.uid()
  ));

-- ============================================================
-- JOB_LINE_ITEMS
-- ============================================================
CREATE POLICY "line_items_owner_pa" ON public.job_line_items FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "line_items_mechanic_read" ON public.job_line_items FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND public.is_mechanic_for_job(job_id));

-- ============================================================
-- JOB_STATUS_HISTORY
-- ============================================================
CREATE POLICY "history_owner_pa" ON public.job_status_history FOR SELECT
  USING (public.is_owner_or_pa());

CREATE POLICY "history_mechanic_read" ON public.job_status_history FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = job_status_history.job_id AND mechanic_id = auth.uid()
  ));

-- ============================================================
-- INVOICES
-- ============================================================
CREATE POLICY "invoices_owner_pa" ON public.invoices FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

-- ============================================================
-- SCOPE_CHANGES
-- ============================================================
CREATE POLICY "scope_owner_pa" ON public.scope_changes FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "scope_mechanic_read" ON public.scope_changes FOR SELECT
  USING (public.get_user_role() = 'mechanic' AND public.is_mechanic_for_job(job_id));

CREATE POLICY "scope_mechanic_flag" ON public.scope_changes FOR INSERT
  WITH CHECK (public.get_user_role() = 'mechanic' AND public.is_mechanic_for_job(job_id));

-- ============================================================
-- DRIVER_WORK_ORDERS
-- ============================================================
CREATE POLICY "dwo_owner_pa" ON public.driver_work_orders FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

CREATE POLICY "dwo_driver_read" ON public.driver_work_orders FOR SELECT
  USING (public.get_user_role() = 'driver' AND driver_id = auth.uid());

CREATE POLICY "dwo_driver_update" ON public.driver_work_orders FOR UPDATE
  USING (public.get_user_role() = 'driver' AND driver_id = auth.uid())
  WITH CHECK (public.get_user_role() = 'driver' AND driver_id = auth.uid());

-- ============================================================
-- MESSAGE_LOG, REMINDER_LOG
-- ============================================================
CREATE POLICY "message_log_owner_pa" ON public.message_log FOR SELECT
  USING (public.is_owner_or_pa());

CREATE POLICY "reminder_log_owner_pa" ON public.reminder_log FOR SELECT
  USING (public.is_owner_or_pa());

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE POLICY "expenses_owner_pa" ON public.expenses FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

-- ============================================================
-- Reporting role (read-only for BI tools)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'garage_reporting') THEN
    CREATE ROLE garage_reporting NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO garage_reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO garage_reporting;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO garage_reporting;
