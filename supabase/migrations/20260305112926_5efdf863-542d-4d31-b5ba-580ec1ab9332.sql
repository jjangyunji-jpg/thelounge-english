
-- Add group_students to class_sessions
ALTER TABLE public.class_sessions 
ADD COLUMN IF NOT EXISTS group_students text[] NOT NULL DEFAULT '{}'::text[];

-- Add group_students to instructor_students (for auto-copy on session generation)
ALTER TABLE public.instructor_students 
ADD COLUMN IF NOT EXISTS group_students text[] NOT NULL DEFAULT '{}'::text[];
