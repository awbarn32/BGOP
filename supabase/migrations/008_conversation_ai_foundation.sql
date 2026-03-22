CREATE TABLE IF NOT EXISTS public.conversation_message_localizations (
  message_id UUID PRIMARY KEY REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  source_language VARCHAR(10) NOT NULL DEFAULT 'unknown'
    CHECK (source_language IN ('th', 'en', 'unknown')),
  text_en TEXT,
  text_th TEXT,
  model VARCHAR(100),
  prompt_version VARCHAR(50),
  translated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_tokens INT NOT NULL DEFAULT 0,
  cached_input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  reasoning_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_thread_ai_state (
  thread_id UUID PRIMARY KEY REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_summarized_message_id UUID REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  summarized_message_count INT NOT NULL DEFAULT 0,
  model VARCHAR(100),
  prompt_version VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  feature VARCHAR(30) NOT NULL CHECK (feature IN ('translation', 'summary', 'reply_draft')),
  status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  model VARCHAR(100),
  prompt_version VARCHAR(50),
  input_tokens INT NOT NULL DEFAULT 0,
  cached_input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  reasoning_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_search
  ON public.conversation_messages
  USING GIN (to_tsvector('simple', coalesce(body_text, '')));

CREATE INDEX IF NOT EXISTS idx_conv_ai_runs_thread_created
  ON public.conversation_ai_runs(thread_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'conv_message_localizations_set_updated_at'
  ) THEN
    CREATE TRIGGER conv_message_localizations_set_updated_at
      BEFORE UPDATE ON public.conversation_message_localizations
      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'conv_thread_ai_state_set_updated_at'
  ) THEN
    CREATE TRIGGER conv_thread_ai_state_set_updated_at
      BEFORE UPDATE ON public.conversation_thread_ai_state
      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.conversation_message_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_thread_ai_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_ai_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_message_localizations_owner_pa" ON public.conversation_message_localizations;
CREATE POLICY "conv_message_localizations_owner_pa" ON public.conversation_message_localizations FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

DROP POLICY IF EXISTS "conv_thread_ai_state_owner_pa" ON public.conversation_thread_ai_state;
CREATE POLICY "conv_thread_ai_state_owner_pa" ON public.conversation_thread_ai_state FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());

DROP POLICY IF EXISTS "conv_ai_runs_owner_pa" ON public.conversation_ai_runs;
CREATE POLICY "conv_ai_runs_owner_pa" ON public.conversation_ai_runs FOR ALL
  USING (public.is_owner_or_pa()) WITH CHECK (public.is_owner_or_pa());
