ALTER TABLE public.holiday_notices
  ADD COLUMN IF NOT EXISTS notified_15d boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_7d boolean NOT NULL DEFAULT false;