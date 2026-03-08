-- Track prepaid session credits per student
CREATE TABLE public.prepaid_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  total_sessions integer NOT NULL DEFAULT 0,
  used_sessions integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_name)
);

ALTER TABLE public.prepaid_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage prepaid credits" ON public.prepaid_credits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Track monthly deduction history
CREATE TABLE public.prepaid_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  month text NOT NULL,
  deducted_sessions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_name, month)
);

ALTER TABLE public.prepaid_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage prepaid deductions" ON public.prepaid_deductions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));