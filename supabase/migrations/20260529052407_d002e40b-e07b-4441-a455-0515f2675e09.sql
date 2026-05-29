ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS is_substitute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS substitute_direction text,
  ADD COLUMN IF NOT EXISTS substitute_instructor text,
  ADD COLUMN IF NOT EXISTS substitute_origin_session_id uuid;

CREATE INDEX IF NOT EXISTS idx_class_sessions_substitute_origin
  ON public.class_sessions (substitute_origin_session_id)
  WHERE substitute_origin_session_id IS NOT NULL;

COMMENT ON COLUMN public.class_sessions.is_substitute IS 'true if this session is part of a substitute-instructor handoff (either the original cancelled row or the new mirror row)';
COMMENT ON COLUMN public.class_sessions.substitute_direction IS '''out'' on the original session (cancelled, handed off), ''in'' on the new mirror session (substitute instructor''s actual class)';
COMMENT ON COLUMN public.class_sessions.substitute_instructor IS 'On the original row: the substitute instructor name who took over';
COMMENT ON COLUMN public.class_sessions.substitute_origin_session_id IS 'On the mirror row: the id of the original cancelled session this substitutes for';