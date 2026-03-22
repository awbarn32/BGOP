ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS line_picture_url TEXT;

CREATE TABLE IF NOT EXISTS public.conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL DEFAULT 'line',
  line_user_id VARCHAR(100),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  active_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  latest_message_at TIMESTAMPTZ,
  latest_message_preview TEXT,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, line_user_id)
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  sender_role VARCHAR(20),
  message_type VARCHAR(30) NOT NULL DEFAULT 'text',
  body_text TEXT,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'read')),
  sent_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  raw_payload JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_thread_user_state (
  thread_id UUID NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.line_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id VARCHAR(255) UNIQUE NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_threads_customer ON public.conversation_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_conv_threads_latest ON public.conversation_threads(latest_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conv_messages_thread ON public.conversation_messages(thread_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.line_webhook_events(webhook_event_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'conv_threads_set_updated_at'
  ) THEN
    CREATE TRIGGER conv_threads_set_updated_at
      BEFORE UPDATE ON public.conversation_threads
      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_threads_owner_pa" ON public.conversation_threads;
CREATE POLICY "conv_threads_owner_pa" ON public.conversation_threads FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

DROP POLICY IF EXISTS "conv_messages_owner_pa" ON public.conversation_messages;
CREATE POLICY "conv_messages_owner_pa" ON public.conversation_messages FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

DROP POLICY IF EXISTS "thread_state_own" ON public.conversation_thread_user_state;
CREATE POLICY "thread_state_own" ON public.conversation_thread_user_state FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "thread_state_owner_pa_read" ON public.conversation_thread_user_state;
CREATE POLICY "thread_state_owner_pa_read" ON public.conversation_thread_user_state FOR SELECT
  USING (public.is_owner_or_pa());

DROP POLICY IF EXISTS "webhook_events_no_user_access" ON public.line_webhook_events;
CREATE POLICY "webhook_events_no_user_access" ON public.line_webhook_events FOR ALL
  USING (false);
