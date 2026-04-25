CREATE TABLE public.ai_program_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  program_type text NOT NULL CHECK (program_type IN ('challenge_21', 'diary_lounge', 'english_pt')),
  start_month text NOT NULL,
  end_month text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_program_subscribers_program ON public.ai_program_subscribers(program_type);

ALTER TABLE public.ai_program_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can manage ai program subscribers"
  ON public.ai_program_subscribers FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Staff can read ai program subscribers"
  ON public.ai_program_subscribers FOR SELECT TO authenticated
  USING (is_staff_or_above(auth.uid()));

CREATE TRIGGER update_ai_program_subscribers_updated_at
  BEFORE UPDATE ON public.ai_program_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_program_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.ai_program_subscribers(id) ON DELETE CASCADE,
  month text NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  amount_override integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, month)
);

CREATE INDEX idx_ai_program_payments_month ON public.ai_program_payments(month);

ALTER TABLE public.ai_program_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can manage ai program payments"
  ON public.ai_program_payments FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Staff can read ai program payments"
  ON public.ai_program_payments FOR SELECT TO authenticated
  USING (is_staff_or_above(auth.uid()));

CREATE TRIGGER update_ai_program_payments_updated_at
  BEFORE UPDATE ON public.ai_program_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();