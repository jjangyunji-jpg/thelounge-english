
ALTER TABLE public.class_sessions DISABLE TRIGGER prevent_delete_session_with_data;
DELETE FROM class_sessions WHERE id = '1271a3b2-5fd2-4860-94f8-6ad2e1d03d45';
ALTER TABLE public.class_sessions ENABLE TRIGGER prevent_delete_session_with_data;
