CREATE OR REPLACE FUNCTION public.protect_session_notes_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow clearing notes on cancelled sessions (for makeup note transfer)
  IF OLD.cancellation_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent overwriting existing notes with NULL or empty string
  IF OLD.notes IS NOT NULL AND OLD.notes <> '' 
     AND (NEW.notes IS NULL OR NEW.notes = '') THEN
    RAISE EXCEPTION 'Cannot clear existing notes on session (id: %). Use explicit override if intended.', OLD.id;
  END IF;
  -- Prevent overwriting existing topic with NULL or empty string
  -- UNLESS the session has no notes and hasn't been started (schedule cleanup)
  IF OLD.topic IS NOT NULL AND OLD.topic <> ''
     AND (NEW.topic IS NULL OR NEW.topic = '')
     AND NOT (OLD.notes IS NULL OR OLD.notes = '')
     AND OLD.started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot clear existing topic on session (id: %).', OLD.id;
  END IF;
  RETURN NEW;
END;
$function$;