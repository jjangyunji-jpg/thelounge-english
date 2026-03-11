
CREATE POLICY "Students can read own payment confirmation"
  ON public.payment_confirmations
  FOR SELECT
  TO authenticated
  USING (
    student_name IN (
      SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()
    )
  );
