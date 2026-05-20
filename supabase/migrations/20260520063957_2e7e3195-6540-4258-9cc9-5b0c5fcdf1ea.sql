-- Stop auto-creating vocab test preset homework when a student is approved
CREATE OR REPLACE FUNCTION public.on_user_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _student_name text;
BEGIN
  IF NEW.approved = true AND (OLD.approved IS DISTINCT FROM true) THEN
    IF NEW.role = 'student' THEN
      _student_name := COALESCE(NEW.display_name, 'Unknown');

      INSERT INTO public.student_profiles (user_id, student_name)
      VALUES (NEW.user_id, _student_name)
      ON CONFLICT (user_id) DO NOTHING;

    ELSIF NEW.role = 'instructor' THEN
      NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Remove existing auto-generated vocab/expression test presets for ALL students
-- (단어 테스트는 학생 대시보드에서 별도 행으로 노출되므로 숙제칸 중복 제거)
DELETE FROM public.homework_assignments
WHERE is_preset = true
  AND title IN (
    '단어 테스트 1회 이상 참여하기',
    '단어 시험',
    '표현 시험',
    '단어 테스트',
    '표현 테스트',
    '핵심표현 테스트'
  );

-- Also delete any copies of these presets that were already auto-spawned into sessions
DELETE FROM public.homework_assignments
WHERE preset_origin_id IS NOT NULL
  AND title IN (
    '단어 테스트 1회 이상 참여하기',
    '단어 시험',
    '표현 시험',
    '단어 테스트',
    '표현 테스트',
    '핵심표현 테스트'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.homework_submissions hs
    WHERE hs.assignment_id = homework_assignments.id
  );