ALTER TABLE public.class_sessions DROP CONSTRAINT IF EXISTS class_sessions_cancellation_type_check;
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_cancellation_type_check
  CHECK (cancellation_type IS NULL OR cancellation_type = ANY (ARRAY['student_cancel','no_show','sick','instructor_cancel','advance_cancel','late_cancel']));