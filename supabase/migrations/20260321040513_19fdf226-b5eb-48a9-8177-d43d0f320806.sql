
DROP POLICY "Students can update own submitted submissions" ON homework_submissions;

CREATE POLICY "Students can update own submissions"
ON homework_submissions FOR UPDATE TO authenticated
USING (
  student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid())
  AND status IN ('submitted', 'draft')
)
WITH CHECK (
  student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid())
  AND status IN ('submitted', 'draft')
);
