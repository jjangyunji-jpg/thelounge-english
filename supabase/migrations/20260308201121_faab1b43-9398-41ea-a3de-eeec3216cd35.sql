CREATE TABLE public.cash_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  receipt_type text NOT NULL DEFAULT 'phone',
  receipt_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;

-- Students can insert/update their own
CREATE POLICY "Students can insert own receipt" ON public.cash_receipts
  FOR INSERT TO authenticated
  WITH CHECK (student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()));

CREATE POLICY "Students can update own receipt" ON public.cash_receipts
  FOR UPDATE TO authenticated
  USING (student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()));

CREATE POLICY "Students can read own receipt" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()));

-- Admin can read all
CREATE POLICY "Admin can read all receipts" ON public.cash_receipts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX cash_receipts_student_name_idx ON public.cash_receipts (student_name);