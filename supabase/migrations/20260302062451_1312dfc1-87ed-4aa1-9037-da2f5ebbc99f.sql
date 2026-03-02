-- Drop the existing unique constraint on email
ALTER TABLE public.instructors DROP CONSTRAINT IF EXISTS instructors_email_key;

-- Allow email to be nullable
ALTER TABLE public.instructors ALTER COLUMN email DROP NOT NULL;

-- Add a partial unique index that only applies to non-null, non-empty emails
CREATE UNIQUE INDEX instructors_email_unique ON public.instructors (email) WHERE email IS NOT NULL AND email <> '';

-- Clean up existing empty-string emails to NULL
UPDATE public.instructors SET email = NULL WHERE email = '';