CREATE OR REPLACE FUNCTION public.student_cancel_class_session(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _student_name text;
  _session record;
  _student_type text;
  _hours_until numeric;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION '인증이 필요합니다.';
  END IF;

  SELECT student_name INTO _student_name
  FROM public.student_profiles
  WHERE user_id = _user_id;

  IF _student_name IS NULL THEN
    RAISE EXCEPTION '학생 정보를 찾을 수 없습니다.';
  END IF;

  SELECT * INTO _session FROM public.class_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '수업을 찾을 수 없습니다.';
  END IF;

  IF _session.student_name <> _student_name AND NOT (_session.group_students @> ARRAY[_student_name]) THEN
    RAISE EXCEPTION '본인 수업만 취소할 수 있습니다.';
  END IF;

  IF _session.cancellation_type IS NOT NULL THEN
    RAISE EXCEPTION '이미 취소 처리된 수업입니다.';
  END IF;

  IF _session.started_at IS NOT NULL THEN
    RAISE EXCEPTION '이미 시작된 수업은 취소할 수 없습니다. 강사에게 문의해주세요.';
  END IF;

  -- Determine the actual session-owner student's type (for group classes use the primary student_name)
  SELECT student_type INTO _student_type
  FROM public.instructor_students
  WHERE student_name = _session.student_name
  LIMIT 1;

  _hours_until := EXTRACT(EPOCH FROM (_session.scheduled_at - now())) / 3600.0;

  -- Corporate students: special handling
  IF _student_type = 'corporate' THEN
    IF _hours_until >= 48 THEN
      -- Outside 48h: delete the session entirely (not billed)
      DELETE FROM public.class_sessions WHERE id = _session_id;
      RETURN jsonb_build_object('success', true, 'action', 'deleted', 'hours_until', _hours_until);
    ELSE
      -- Within 48h: mark as late_cancel (billed)
      UPDATE public.class_sessions
      SET cancellation_type = 'late_cancel'
      WHERE id = _session_id;
      RETURN jsonb_build_object('success', true, 'cancellation_type', 'late_cancel', 'hours_until', _hours_until);
    END IF;
  END IF;

  -- Default (non-corporate): existing behavior
  UPDATE public.class_sessions
  SET cancellation_type = 'student_cancel'
  WHERE id = _session_id;

  RETURN jsonb_build_object('success', true, 'cancellation_type', 'student_cancel', 'hours_until', _hours_until);
END;
$$;