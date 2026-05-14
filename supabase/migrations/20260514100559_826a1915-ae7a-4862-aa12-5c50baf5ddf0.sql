CREATE OR REPLACE FUNCTION public.student_cancel_class_session(_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _student_name text;
  _session record;
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

  -- 강사가 이미 수업을 시작했다면 취소 불가 (노쇼는 강사가 직접 분류)
  IF _session.started_at IS NOT NULL THEN
    RAISE EXCEPTION '이미 시작된 수업은 취소할 수 없습니다. 강사에게 문의해주세요.';
  END IF;

  -- 학생이 직접 취소하는 경우 항상 student_cancel 로 분류 (지난 일정 포함)
  -- 노쇼 분류는 강사 권한
  UPDATE public.class_sessions
  SET cancellation_type = 'student_cancel'
  WHERE id = _session_id;

  RETURN jsonb_build_object('success', true, 'cancellation_type', 'student_cancel');
END;
$function$;