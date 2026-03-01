
-- Create student_pauses table for multiple pause periods
CREATE TABLE public.student_pauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.instructor_students(id) ON DELETE CASCADE,
  pause_start DATE NOT NULL,
  pause_end DATE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all student_pauses"
ON public.student_pauses
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient lookups
CREATE INDEX idx_student_pauses_student_id ON public.student_pauses(student_id);
CREATE INDEX idx_student_pauses_dates ON public.student_pauses(pause_start, pause_end);
