DELETE FROM public.deleted_session_dates WHERE student_name='진아' AND deleted_date='2026-07-01';
INSERT INTO public.class_sessions (student_name, instructor_name, scheduled_at)
VALUES ('진아', '장리원', '2026-07-01 13:00:00+00');