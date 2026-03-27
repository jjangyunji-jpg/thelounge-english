
CREATE OR REPLACE FUNCTION public.protect_session_with_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Back up notes before deletion if they exist
  IF OLD.notes IS NOT NULL AND OLD.notes <> '' THEN
    INSERT INTO public.class_session_note_versions (session_id, notes, topic, saved_at)
    VALUES (OLD.id, OLD.notes, OLD.topic, now());
  END IF;
  -- Allow deletion
  RETURN OLD;
END;
$function$;
