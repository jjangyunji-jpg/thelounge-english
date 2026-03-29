CREATE POLICY "Students can book open slots"
ON public.instructor_available_slots
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND status = 'open'
)
WITH CHECK (
  has_role(auth.uid(), 'student'::app_role)
  AND status = 'booked'
);