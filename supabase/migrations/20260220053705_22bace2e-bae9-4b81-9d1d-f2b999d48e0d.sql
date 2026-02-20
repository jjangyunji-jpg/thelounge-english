ALTER TABLE public.instructor_students
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS level text DEFAULT 'B1',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS extra_lessons integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lesson_goal text,
  ADD COLUMN IF NOT EXISTS lesson_goal_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS schedules text,
  ADD COLUMN IF NOT EXISTS instructor_name text;