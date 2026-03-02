-- Temporarily disable protection triggers
ALTER TABLE public.class_sessions DISABLE TRIGGER prevent_delete_session_with_data;
ALTER TABLE public.class_sessions DISABLE TRIGGER protect_session_notes_on_update;

-- Delete note versions first
DELETE FROM class_session_note_versions WHERE session_id = '7d731f26-da52-456c-973b-6f1f370b54d5';

-- Delete the session
DELETE FROM class_sessions WHERE id = '7d731f26-da52-456c-973b-6f1f370b54d5';

-- Re-enable protection triggers
ALTER TABLE public.class_sessions ENABLE TRIGGER prevent_delete_session_with_data;
ALTER TABLE public.class_sessions ENABLE TRIGGER protect_session_notes_on_update;