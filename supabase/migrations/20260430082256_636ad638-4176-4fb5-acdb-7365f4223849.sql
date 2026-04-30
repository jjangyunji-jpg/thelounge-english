-- Allow students to request cancellation of their own approved makeup requests
-- by transitioning status: 'approved' -> 'cancel_requested'.
-- The actual cancellation (session restoration, gcal cleanup) is performed by
-- the instructor via the handle-makeup-request edge function.

CREATE POLICY "Student can request cancel of own approved request"
ON public.makeup_requests
FOR UPDATE
TO authenticated
USING (
  (student_name IN (
    SELECT sp.student_name FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
  )) AND status = 'approved'
)
WITH CHECK (
  (student_name IN (
    SELECT sp.student_name FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
  )) AND status = 'cancel_requested'
);
