
-- Add cancellation_type column to class_sessions
ALTER TABLE public.class_sessions
ADD COLUMN cancellation_type text DEFAULT NULL;

-- Add a check constraint for valid values
ALTER TABLE public.class_sessions
ADD CONSTRAINT class_sessions_cancellation_type_check
CHECK (cancellation_type IS NULL OR cancellation_type IN ('student_cancel', 'no_show', 'sick', 'instructor_cancel'));

-- Index for settlement queries filtering by cancellation type
CREATE INDEX idx_class_sessions_cancellation_type ON public.class_sessions (cancellation_type)
WHERE cancellation_type IS NOT NULL;
