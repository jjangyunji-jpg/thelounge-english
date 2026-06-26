
-- Extend homework_event_logs into a general-purpose event log
ALTER TABLE public.homework_event_logs
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'homework',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS function_name text,
  ADD COLUMN IF NOT EXISTS pg_details text,
  ADD COLUMN IF NOT EXISTS pg_hint text,
  ADD COLUMN IF NOT EXISTS stack text,
  ADD COLUMN IF NOT EXISTS http_status int;

CREATE INDEX IF NOT EXISTS idx_event_logs_category ON public.homework_event_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_source_type ON public.homework_event_logs (source_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_error_code ON public.homework_event_logs (error_code, created_at DESC) WHERE error_code IS NOT NULL;

-- Allow service_role full access (used by edge functions)
GRANT ALL ON public.homework_event_logs TO service_role;
