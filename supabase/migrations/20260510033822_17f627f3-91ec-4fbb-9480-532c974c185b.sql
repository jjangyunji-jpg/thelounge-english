
CREATE TABLE public.renewal_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  period_id uuid NOT NULL REFERENCES public.schedule_periods(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('extend','withdraw')),
  decided_via text NOT NULL DEFAULT 'student' CHECK (decided_via IN ('student','instructor','admin')),
  decided_by_user_id uuid,
  decided_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_name, period_id)
);

CREATE INDEX idx_renewal_confirmations_period ON public.renewal_confirmations(period_id);
CREATE INDEX idx_renewal_confirmations_student ON public.renewal_confirmations(student_name);

ALTER TABLE public.renewal_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read renewal confirmations"
  ON public.renewal_confirmations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Students can insert own renewal confirmation"
  ON public.renewal_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (
    student_name IN (
      SELECT sp.student_name FROM public.student_profiles sp WHERE sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Manager or instructor can insert renewal confirmations"
  ON public.renewal_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Manager can update renewal confirmations"
  ON public.renewal_confirmations FOR UPDATE
  TO authenticated
  USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Manager can delete renewal confirmations"
  ON public.renewal_confirmations FOR DELETE
  TO authenticated
  USING (is_manager_or_above(auth.uid()));
