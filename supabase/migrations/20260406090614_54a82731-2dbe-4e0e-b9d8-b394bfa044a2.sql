-- Add transfer metadata columns to instructor_students
ALTER TABLE public.instructor_students
  ADD COLUMN IF NOT EXISTS transfer_from_id uuid REFERENCES public.instructor_students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_date date,
  ADD COLUMN IF NOT EXISTS transfer_status text;

-- Add index for efficient lookup of pending transfers
CREATE INDEX IF NOT EXISTS idx_instructor_students_transfer_status 
  ON public.instructor_students(transfer_status) 
  WHERE transfer_status IS NOT NULL;