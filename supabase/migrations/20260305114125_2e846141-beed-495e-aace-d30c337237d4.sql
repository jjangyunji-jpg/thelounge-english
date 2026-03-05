ALTER TABLE public.instructor_students ADD COLUMN IF NOT EXISTS student_type text NOT NULL DEFAULT 'regular';
COMMENT ON COLUMN public.instructor_students.student_type IS 'regular or corporate';