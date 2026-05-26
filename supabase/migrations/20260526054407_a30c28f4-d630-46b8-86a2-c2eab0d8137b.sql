ALTER TABLE public.prepaid_credits DROP CONSTRAINT IF EXISTS prepaid_credits_student_name_key;
ALTER TABLE public.prepaid_credits ADD COLUMN IF NOT EXISTS payment_month text;
ALTER TABLE public.prepaid_credits ADD COLUMN IF NOT EXISTS fee_total integer;
CREATE INDEX IF NOT EXISTS idx_prepaid_credits_student ON public.prepaid_credits(student_name);
CREATE INDEX IF NOT EXISTS idx_prepaid_credits_payment_month ON public.prepaid_credits(payment_month);