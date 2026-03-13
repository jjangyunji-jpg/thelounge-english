ALTER TABLE public.cash_receipts 
  ADD COLUMN recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN recurring_attendance boolean NOT NULL DEFAULT false,
  ALTER COLUMN receipt_number SET DEFAULT '';