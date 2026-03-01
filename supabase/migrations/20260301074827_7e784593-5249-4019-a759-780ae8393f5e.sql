
-- Update the on_user_approved trigger to also create a default preset homework for new students
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
      -- Get email from auth.users
      SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;

      -- Create instructors entry if not exists
      INSERT INTO public.instructors (user_id, name, email)
      VALUES (NEW.user_id, COALESCE(NEW.display_name, 'Unknown'), COALESCE(_email, ''))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
