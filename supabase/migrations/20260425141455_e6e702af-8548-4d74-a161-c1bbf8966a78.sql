-- Table to store manual billable count overrides per student per period
CREATE TABLE public.billable_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  billable_count INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_name, period_start, period_end)
);

ALTER TABLE public.billable_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff or above can read billable overrides"
ON public.billable_overrides FOR SELECT
TO authenticated
USING (public.is_staff_or_above(auth.uid()));

CREATE POLICY "Manager can manage billable overrides"
ON public.billable_overrides FOR ALL
TO authenticated
USING (public.is_manager_or_above(auth.uid()))
WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE TRIGGER update_billable_overrides_updated_at
BEFORE UPDATE ON public.billable_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_billable_overrides_student_period ON public.billable_overrides(student_name, period_start, period_end);