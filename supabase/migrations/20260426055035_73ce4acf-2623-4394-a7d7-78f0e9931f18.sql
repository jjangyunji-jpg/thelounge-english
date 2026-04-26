ALTER TABLE public.instructor_calendar_mapping ADD COLUMN IF NOT EXISTS display_name text;
UPDATE public.instructor_calendar_mapping SET display_name = 'Reina' WHERE instructor_name = '장리원';