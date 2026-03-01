
-- Version history table for class session notes
CREATE TABLE public.class_session_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  notes text,
  topic text,
  saved_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by session
CREATE INDEX idx_note_versions_session ON public.class_session_note_versions(session_id, saved_at DESC);

-- Enable RLS
ALTER TABLE public.class_session_note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all note_versions" ON public.class_session_note_versions
FOR ALL USING (true) WITH CHECK (true);

-- Trigger: auto-save previous version before notes/topic change
CREATE OR REPLACE FUNCTION public.backup_session_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only backup if notes or topic actually changed and old value was not empty
  IF (OLD.notes IS DISTINCT FROM NEW.notes AND OLD.notes IS NOT NULL AND OLD.notes <> '')
     OR (OLD.topic IS DISTINCT FROM NEW.topic AND OLD.topic IS NOT NULL AND OLD.topic <> '') THEN
    INSERT INTO public.class_session_note_versions (session_id, notes, topic, saved_at)
    VALUES (OLD.id, OLD.notes, OLD.topic, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_backup_session_notes
BEFORE UPDATE ON public.class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.backup_session_notes();
