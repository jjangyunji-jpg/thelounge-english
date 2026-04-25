-- Add cash payment flag to instructor_students for payment method tracking
ALTER TABLE public.instructor_students
ADD COLUMN IF NOT EXISTS cash_payment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instructor_students.cash_payment IS 'Default payment method: true = cash/bank transfer, false = smart store. Can be overridden monthly via payment_confirmations.note';