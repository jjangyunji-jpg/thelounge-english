
CREATE OR REPLACE FUNCTION public.protect_session_with_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.notes IS NOT NULL AND OLD.notes <> '' THEN
    RAISE EXCEPTION 'Cannot delete session with notes (id: %)', OLD.id;
  END IF;
  IF OLD.topic IS NOT NULL AND OLD.topic <> '' THEN
    RAISE EXCEPTION 'Cannot delete session with topic (id: %)', OLD.id;
  END IF;
  IF OLD.started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete session that was started (id: %)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_delete_session_with_data
BEFORE DELETE ON public.class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_session_with_data();
