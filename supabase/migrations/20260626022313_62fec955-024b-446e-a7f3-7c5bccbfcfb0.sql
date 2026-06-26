
CREATE TABLE public.homework_event_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  student_name TEXT,
  assignment_id UUID,
  assignment_type TEXT,
  submission_id UUID,
  error_message TEXT,
  error_code TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID,
  source TEXT
);

CREATE INDEX idx_homework_event_logs_created_at ON public.homework_event_logs (created_at DESC);
CREATE INDEX idx_homework_event_logs_stage ON public.homework_event_logs (stage, created_at DESC);
CREATE INDEX idx_homework_event_logs_student ON public.homework_event_logs (student_name, created_at DESC);

GRANT SELECT, INSERT ON public.homework_event_logs TO authenticated;
GRANT SELECT, INSERT ON public.homework_event_logs TO anon;
GRANT ALL ON public.homework_event_logs TO service_role;

ALTER TABLE public.homework_event_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauth) can insert logs; we never trust client identity, just record
CREATE POLICY "Anyone can insert homework event logs"
ON public.homework_event_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only managers/admins can read
CREATE POLICY "Managers can view homework event logs"
ON public.homework_event_logs FOR SELECT
TO authenticated
USING (public.is_manager_or_above(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.homework_event_logs;

-- Auto-cleanup: delete logs older than 30 days, run daily via pg_cron
SELECT cron.schedule(
  'homework-event-logs-cleanup',
  '15 17 * * *', -- 02:15 KST daily
  $$DELETE FROM public.homework_event_logs WHERE created_at < now() - interval '30 days'$$
);
