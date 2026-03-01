
ALTER TABLE public.instructor_students
ADD COLUMN pause_start date DEFAULT NULL,
ADD COLUMN pause_end date DEFAULT NULL;
