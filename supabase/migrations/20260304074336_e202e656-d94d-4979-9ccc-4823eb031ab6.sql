
-- Fix: Restrict instructors SELECT to authenticated users only
DROP POLICY IF EXISTS "Instructors can view all instructors" ON public.instructors;

CREATE POLICY "Authenticated users can view instructors"
  ON public.instructors FOR SELECT
  USING (auth.uid() IS NOT NULL);
