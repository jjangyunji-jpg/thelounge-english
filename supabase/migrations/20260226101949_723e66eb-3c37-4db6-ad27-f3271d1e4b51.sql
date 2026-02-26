
-- Add new columns to instructors table
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS join_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS bio_notes text;
