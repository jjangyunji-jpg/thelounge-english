ALTER TABLE public.class_sessions DROP CONSTRAINT IF EXISTS class_sessions_cancellation_type_check;

ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_cancellation_type_check
  CHECK (
    cancellation_type IS NULL
    OR cancellation_type = ANY (ARRAY['student_cancel'::text, 'no_show'::text, 'sick'::text, 'instructor_cancel'::text, 'advance_cancel'::text])
  );