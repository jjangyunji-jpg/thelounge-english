-- Drop the two restrictive UPDATE policies on instructors
DROP POLICY "Admins can update instructors" ON public.instructors;
DROP POLICY "Only authenticated can update own instructor record" ON public.instructors;

-- Recreate as PERMISSIVE so either condition suffices
CREATE POLICY "Admins can update instructors"
ON public.instructors
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can update own record"
ON public.instructors
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);