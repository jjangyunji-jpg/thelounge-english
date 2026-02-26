
-- Trigger function: auto-register student/instructor when approved
CREATE OR REPLACE FUNCTION public.on_user_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  -- Only fire when approved changes from false to true
  IF NEW.approved = true AND (OLD.approved IS DISTINCT FROM true) THEN
    IF NEW.role = 'student' THEN
      -- Create student_profiles entry if not exists
      INSERT INTO public.student_profiles (user_id, student_name)
      VALUES (NEW.user_id, COALESCE(NEW.display_name, 'Unknown'))
      ON CONFLICT (user_id) DO NOTHING;

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
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_on_user_approved ON public.user_roles;
CREATE TRIGGER trg_on_user_approved
  AFTER UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_user_approved();
