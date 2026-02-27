
-- Add user_id column to instructor_students for account linking
ALTER TABLE public.instructor_students
ADD COLUMN user_id uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Create index for fast lookup
CREATE INDEX idx_instructor_students_user_id ON public.instructor_students(user_id);
