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
  _hours_until numeric;
  _cancel_type text;
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
    RAISE EXCEPTION '이미 시작된 수업은 취소할 수 없습니다.';
  END IF;

  _hours_until := EXTRACT(EPOCH FROM (_session.scheduled_at - now())) / 3600.0;

  IF _hours_until >= 48 THEN
    RAISE EXCEPTION '48시간 이전 수업은 ''일정 변경''을 이용해주세요.';
  ELSIF _hours_until >= 24 THEN
    _cancel_type := 'late_cancel';
  ELSIF _hours_until >= 4 THEN
    _cancel_type := 'student_cancel';
  ELSE
    _cancel_type := 'no_show';
  END IF;

  UPDATE public.class_sessions
  SET cancellation_type = _cancel_type
  WHERE id = _session_id;

  RETURN jsonb_build_object('success', true, 'cancellation_type', _cancel_type, 'hours_until', _hours_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_cancel_class_session(uuid) TO authenticated;