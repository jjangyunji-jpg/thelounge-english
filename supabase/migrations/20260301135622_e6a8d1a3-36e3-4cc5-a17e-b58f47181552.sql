
CREATE OR REPLACE FUNCTION public.on_user_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _student_name text;
BEGIN
  -- Only fire when approved changes from false to true
  IF NEW.approved = true AND (OLD.approved IS DISTINCT FROM true) THEN
    IF NEW.role = 'student' THEN
      _student_name := COALESCE(NEW.display_name, 'Unknown');
      
      -- Create student_profiles entry if not exists
      INSERT INTO public.student_profiles (user_id, student_name)
      VALUES (NEW.user_id, _student_name)
      ON CONFLICT (user_id) DO NOTHING;

      -- Create default vocab test preset homework if not exists
      INSERT INTO public.homework_assignments (student_name, title, type, is_preset)
      SELECT _student_name, '단어 테스트 1회 이상 참여하기', 'memorizing', true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.homework_assignments
        WHERE student_name = _student_name
          AND title = '단어 테스트 1회 이상 참여하기'
          AND is_preset = true
      );

    ELSIF NEW.role = 'instructor' THEN
      -- Do NOT auto-create instructor record.
      -- Admin will link the account to an existing instructor record manually.
      NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
