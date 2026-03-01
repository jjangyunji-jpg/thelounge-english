
-- 1. Protect class_sessions: prevent notes/topic from being accidentally nullified via UPDATE
CREATE OR REPLACE FUNCTION public.protect_session_notes_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent overwriting existing notes with NULL or empty string
  IF OLD.notes IS NOT NULL AND OLD.notes <> '' 
     AND (NEW.notes IS NULL OR NEW.notes = '') THEN
    RAISE EXCEPTION 'Cannot clear existing notes on session (id: %). Use explicit override if intended.', OLD.id;
  END IF;
  -- Prevent overwriting existing topic with NULL or empty string
  IF OLD.topic IS NOT NULL AND OLD.topic <> ''
     AND (NEW.topic IS NULL OR NEW.topic = '') THEN
    RAISE EXCEPTION 'Cannot clear existing topic on session (id: %).', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_session_notes_on_update
BEFORE UPDATE ON public.class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_session_notes_update();

-- 2. Protect business_meetings: prevent deletion of meetings with notes
CREATE OR REPLACE FUNCTION public.protect_meeting_with_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.notes IS NOT NULL AND OLD.notes <> '' THEN
    RAISE EXCEPTION 'Cannot delete meeting with notes (id: %)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_delete_meeting_with_data
BEFORE DELETE ON public.business_meetings
FOR EACH ROW
EXECUTE FUNCTION public.protect_meeting_with_data();

-- 3. Protect class_feedback: prevent deletion entirely (feedback is permanent record)
CREATE OR REPLACE FUNCTION public.protect_feedback_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Cannot delete class feedback records (id: %)', OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_delete_feedback
BEFORE DELETE ON public.class_feedback
FOR EACH ROW
EXECUTE FUNCTION public.protect_feedback_delete();

-- 4. Protect instructors: prevent deletion of instructor with settlement-relevant data
CREATE OR REPLACE FUNCTION public.protect_instructor_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  session_count integer;
  meeting_count integer;
BEGIN
  SELECT COUNT(*) INTO session_count FROM public.class_sessions WHERE instructor_name = OLD.name;
  SELECT COUNT(*) INTO meeting_count FROM public.business_meetings WHERE instructor_id = OLD.id;
  IF session_count > 0 OR meeting_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete instructor "%" with % sessions and % meetings on record', OLD.name, session_count, meeting_count;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_delete_instructor_with_records
BEFORE DELETE ON public.instructors
FOR EACH ROW
EXECUTE FUNCTION public.protect_instructor_delete();
