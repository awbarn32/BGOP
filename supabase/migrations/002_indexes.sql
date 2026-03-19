-- ============================================================
-- BGOP Migration 002: Indexes
-- Optimized for Kanban board queries, reporting, and CRON jobs
-- ============================================================

-- Jobs — primary Kanban queries
CREATE INDEX idx_jobs_bucket_priority ON public.jobs(bucket, priority);
CREATE INDEX idx_jobs_bucket_status ON public.jobs(bucket, status);
CREATE INDEX idx_jobs_mechanic ON public.jobs(mechanic_id);
CREATE INDEX idx_jobs_customer ON public.jobs(customer_id);
CREATE INDEX idx_jobs_vehicle ON public.jobs(vehicle_id);
CREATE INDEX idx_jobs_created ON public.jobs(created_at);
CREATE INDEX idx_jobs_archived ON public.jobs(archived_at) WHERE archived_at IS NOT NULL;

-- Job status history — timeline queries
CREATE INDEX idx_job_status_history_job ON public.job_status_history(job_id);
CREATE INDEX idx_job_status_history_changed ON public.job_status_history(changed_at);

-- Invoices — AR aging and reporting
CREATE INDEX idx_invoices_customer_status ON public.invoices(customer_id, status);
CREATE INDEX idx_invoices_stream_date ON public.invoices(revenue_stream, invoice_date);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- Vehicles — service reminder CRON
CREATE INDEX idx_vehicles_last_service ON public.vehicles(last_service_date);
CREATE INDEX idx_vehicles_customer ON public.vehicles(customer_id);

-- Customers — dormant segmentation CRON
CREATE INDEX idx_customers_dormant ON public.customers(dormant);
CREATE INDEX idx_customers_phone ON public.customers(phone);

-- Scope changes
CREATE INDEX idx_scope_changes_status ON public.scope_changes(status);
CREATE INDEX idx_scope_changes_job ON public.scope_changes(job_id);

-- Message log
CREATE INDEX idx_message_log_sent ON public.message_log(sent_at);
CREATE INDEX idx_message_log_customer ON public.message_log(customer_id);

-- Driver work orders
CREATE INDEX idx_driver_work_orders_job ON public.driver_work_orders(job_id);
CREATE INDEX idx_driver_work_orders_driver ON public.driver_work_orders(driver_id);

-- Products and templates
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(active) WHERE active = true;
CREATE INDEX idx_job_templates_active ON public.job_templates(active) WHERE active = true;

-- Expenses
CREATE INDEX idx_expenses_date ON public.expenses(date);
