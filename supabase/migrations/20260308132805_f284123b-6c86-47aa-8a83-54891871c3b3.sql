CREATE POLICY "Students can update own submitted submissions"
ON public.homework_submissions
FOR UPDATE
TO authenticated
USING (
  student_name IN (
    SELECT sp.student_name FROM public.student_profiles sp WHERE sp.user_id = auth.uid()
  )
  AND status = 'submitted'
)
WITH CHECK (
  student_name IN (
    SELECT sp.student_name FROM public.student_profiles sp WHERE sp.user_id = auth.uid()
  )
  AND status = 'submitted'
);