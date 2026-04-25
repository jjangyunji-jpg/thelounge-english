-- Allow staff/manager to fully manage cash_receipts for any student
CREATE POLICY "Staff or above can insert receipts"
ON public.cash_receipts
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_or_above(auth.uid()));

CREATE POLICY "Staff or above can update receipts"
ON public.cash_receipts
FOR UPDATE
TO authenticated
USING (public.is_staff_or_above(auth.uid()))
WITH CHECK (public.is_staff_or_above(auth.uid()));

CREATE POLICY "Manager can delete receipts"
ON public.cash_receipts
FOR DELETE
TO authenticated
USING (public.is_manager_or_above(auth.uid()));