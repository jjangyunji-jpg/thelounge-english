-- ============================================
-- Security fixes: privilege escalation, instructor PII exposure, class_feedback exposure
-- ============================================

-- 1) Helper functions: require approved = true so unapproved roles cannot pass role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND approved = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
      AND approved = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager', 'staff')
      AND approved = true
  )
$$;

-- 2) instructors: stop exposing emails, phones, rates, bio_notes, age, etc. to all
--    authenticated users. Provide a public view with safe columns only, and keep
--    full-row access for the instructor themselves and managers.
DROP POLICY IF EXISTS "Authenticated users can view instructors" ON public.instructors;

CREATE POLICY "Instructor can view own record"
  ON public.instructors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Manager can view all instructors"
  ON public.instructors FOR SELECT
  TO authenticated
  USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Staff can view all instructors"
  ON public.instructors FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::public.app_role));

-- Public-safe view: only non-sensitive identification fields needed by students
-- and other instructors to display names / availability.
CREATE OR REPLACE VIEW public.instructor_directory
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  position,
  active,
  meet_link
FROM public.instructors
WHERE active = true;

GRANT SELECT ON public.instructor_directory TO authenticated;

-- 3) class_feedback: students leave anonymous-style ratings + comments about
--    instructors. Restrict reads to: the submitting student, the instructor
--    being rated, and staff/managers. (Insert policy unchanged.)
DROP POLICY IF EXISTS "Authenticated can read feedback" ON public.class_feedback;

CREATE POLICY "Submitting student can read own feedback"
  ON public.class_feedback FOR SELECT
  TO authenticated
  USING (
    student_name IN (
      SELECT sp.student_name FROM public.student_profiles sp
      WHERE sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Instructor can read feedback about themselves"
  ON public.class_feedback FOR SELECT
  TO authenticated
  USING (
    instructor_name IN (
      SELECT i.name FROM public.instructors i
      WHERE i.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff or above can read all feedback"
  ON public.class_feedback FOR SELECT
  TO authenticated
  USING (public.is_staff_or_above(auth.uid()));