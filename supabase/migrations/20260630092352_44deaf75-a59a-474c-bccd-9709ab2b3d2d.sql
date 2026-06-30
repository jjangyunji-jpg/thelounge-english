CREATE UNIQUE INDEX IF NOT EXISTS uniq_homework_submissions_assignment_student
ON public.homework_submissions (assignment_id, student_name);