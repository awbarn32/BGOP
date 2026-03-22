-- One durable thread per external contact per channel.
-- Unique on (channel, line_user_id) - one LINE thread per LINE user forever.
CREATE TABLE public.conversation_threads (
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

-- Canonical message transcript. One row per message/event.
CREATE TABLE public.conversation_messages (
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

-- Per-staff-user inbox state. Stores read/resolve state per owner/PA user.
-- This is the authority for unread and resolved - not the threads table.
CREATE TABLE public.conversation_thread_user_state (
  thread_id UUID NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, user_id)
);

-- Webhook deduplication. Prevents duplicate processing of redelivered LINE events.
CREATE TABLE public.line_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id VARCHAR(255) UNIQUE NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_threads_customer ON public.conversation_threads(customer_id);
CREATE INDEX idx_conv_threads_latest ON public.conversation_threads(latest_message_at DESC NULLS LAST);
CREATE INDEX idx_conv_messages_thread ON public.conversation_messages(thread_id, sent_at DESC);
CREATE INDEX idx_webhook_events_event_id ON public.line_webhook_events(webhook_event_id);

CREATE TRIGGER conv_threads_set_updated_at
  BEFORE UPDATE ON public.conversation_threads
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
