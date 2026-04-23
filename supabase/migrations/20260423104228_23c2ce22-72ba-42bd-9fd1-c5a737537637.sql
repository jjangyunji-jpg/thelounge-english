-- Permit students to read the instructor row(s) they are currently assigned to.
-- This is required so the student dashboard can resolve the instructor's
-- display name (via user_id -> user_roles). Other instructors and students
-- not assigned to this instructor still cannot read the row.
CREATE POLICY "Student can view own assigned instructor"
  ON public.instructors FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT s.instructor_id
      FROM public.instructor_students s
      JOIN public.student_profiles sp ON sp.student_name = s.student_name
      WHERE sp.user_id = auth.uid()
    )
  );

-- Also let any authenticated instructor look up other instructors' basic info
-- via the safe directory view (already granted). For features that need the
-- full instructors row from instructor accounts (e.g. peer scheduling), add
-- targeted policies on a case-by-case basis.