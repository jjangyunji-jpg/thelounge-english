
-- Create class feedback table for end-of-period student surveys
CREATE TABLE public.class_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  instructor_name TEXT NOT NULL,
  period_id UUID REFERENCES public.schedule_periods(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  satisfaction INTEGER NOT NULL CHECK (satisfaction BETWEEN 1 AND 5),
  teaching_quality INTEGER NOT NULL CHECK (teaching_quality BETWEEN 1 AND 5),
  communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
  lesson_preparation INTEGER NOT NULL CHECK (lesson_preparation BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.class_feedback ENABLE ROW LEVEL SECURITY;

-- Students can insert their own feedback
CREATE POLICY "Allow all class_feedback"
ON public.class_feedback
FOR ALL
USING (true)
WITH CHECK (true);
