
-- 1) Unique guard: one copy per (preset, session)
CREATE UNIQUE INDEX IF NOT EXISTS uq_homework_assignments_preset_session
  ON public.homework_assignments (preset_origin_id, session_id)
  WHERE preset_origin_id IS NOT NULL AND session_id IS NOT NULL;

-- 2) Helper: create a session copy for a (preset, session) pair if missing
CREATE OR REPLACE FUNCTION public.ensure_homework_session_copy(_preset_id uuid, _session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _preset record;
  _session record;
BEGIN
  SELECT * INTO _preset FROM public.homework_assignments WHERE id = _preset_id AND is_preset = true;
  IF NOT FOUND THEN RETURN; END IF;

  -- Skip vocab-test memorizing presets (handled separately in UI)
  IF _preset.type = 'memorizing' AND _preset.title ILIKE '%단어 테스트%' THEN
    RETURN;
  END IF;

  SELECT * INTO _session FROM public.class_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Student must match (single or group)
  IF _session.student_name <> _preset.student_name
     AND NOT (COALESCE(_session.group_students, '{}'::text[]) @> ARRAY[_preset.student_name]) THEN
    RETURN;
  END IF;

  -- Don't create copies for sessions that existed before the preset (no retroactive)
  IF _session.scheduled_at < _preset.created_at THEN
    RETURN;
  END IF;

  INSERT INTO public.homework_assignments
    (session_id, student_name, type, title, description, is_preset, due_at, preset_origin_id)
  VALUES
    (_session.id, _preset.student_name, _preset.type, _preset.title, _preset.description,
     false, _preset.due_at, _preset.id)
  ON CONFLICT (preset_origin_id, session_id) WHERE preset_origin_id IS NOT NULL AND session_id IS NOT NULL
  DO NOTHING;
END;
$$;

-- 3) Trigger: when a new preset is created, fan out to all future scheduled sessions
CREATE OR REPLACE FUNCTION public.tr_homework_preset_fanout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sess record;
BEGIN
  IF NEW.is_preset = false THEN RETURN NEW; END IF;
  IF NEW.type = 'memorizing' AND NEW.title ILIKE '%단어 테스트%' THEN RETURN NEW; END IF;

  FOR _sess IN
    SELECT id FROM public.class_sessions
    WHERE (student_name = NEW.student_name OR COALESCE(group_students, '{}'::text[]) @> ARRAY[NEW.student_name])
      AND scheduled_at >= NEW.created_at
      AND cancellation_type IS NULL
  LOOP
    PERFORM public.ensure_homework_session_copy(NEW.id, _sess.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_preset_fanout ON public.homework_assignments;
CREATE TRIGGER trg_homework_preset_fanout
  AFTER INSERT ON public.homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tr_homework_preset_fanout();

-- 4) Trigger: when a new session is created, fan in all active presets for that student
CREATE OR REPLACE FUNCTION public.tr_session_homework_fanin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _preset record;
  _names text[];
BEGIN
  IF NEW.cancellation_type IS NOT NULL THEN RETURN NEW; END IF;

  _names := ARRAY[NEW.student_name] || COALESCE(NEW.group_students, '{}'::text[]);

  FOR _preset IN
    SELECT id FROM public.homework_assignments
    WHERE is_preset = true
      AND student_name = ANY(_names)
      AND created_at <= NEW.scheduled_at
      AND NOT (type = 'memorizing' AND title ILIKE '%단어 테스트%')
  LOOP
    PERFORM public.ensure_homework_session_copy(_preset.id, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_homework_fanin ON public.class_sessions;
CREATE TRIGGER trg_session_homework_fanin
  AFTER INSERT ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tr_session_homework_fanin();

-- 5) Backfill: create missing copies for all currently-future, non-cancelled sessions
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS preset_id, s.id AS session_id
    FROM public.homework_assignments p
    JOIN public.class_sessions s
      ON (s.student_name = p.student_name
          OR COALESCE(s.group_students, '{}'::text[]) @> ARRAY[p.student_name])
    WHERE p.is_preset = true
      AND NOT (p.type = 'memorizing' AND p.title ILIKE '%단어 테스트%')
      AND s.cancellation_type IS NULL
      AND s.scheduled_at >= p.created_at
      AND s.scheduled_at >= now()
      AND NOT EXISTS (
        SELECT 1 FROM public.homework_assignments c
        WHERE c.preset_origin_id = p.id AND c.session_id = s.id
      )
  LOOP
    PERFORM public.ensure_homework_session_copy(r.preset_id, r.session_id);
  END LOOP;
END $$;
