
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

      -- No longer auto-create preset vocab test homework

    ELSIF NEW.role = 'instructor' THEN
      NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
