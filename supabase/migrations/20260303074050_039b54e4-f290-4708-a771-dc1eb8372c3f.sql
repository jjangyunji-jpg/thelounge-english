-- Allow deleting sessions that have topic but no notes and haven't started
-- This enables schedule change cleanup
CREATE OR REPLACE FUNCTION public.protect_session_with_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.notes IS NOT NULL AND OLD.notes <> '' THEN
    RAISE EXCEPTION 'Cannot delete session with notes (id: %)', OLD.id;
  END IF;
  IF OLD.started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete session that was started (id: %)', OLD.id;
  END IF;
  -- Allow deleting sessions with topic if they have no notes and haven't started
  RETURN OLD;
END;
$function$;