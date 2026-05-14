-- 1) Waitlist: drop the broad "see waiting queue" policy. Own-row + admin policies remain.
DROP POLICY IF EXISTS "Users can see waiting queue" ON public.waitlist_entries;

-- 2) Homework files: tighten UPDATE policy to require ownership of the assignment folder
DROP POLICY IF EXISTS "Authenticated users can update own homework files" ON storage.objects;

CREATE POLICY "Owner or staff can update homework files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    public.is_staff_or_above(auth.uid())
    OR public.has_role(auth.uid(), 'instructor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.homework_assignments ha
      JOIN public.student_profiles sp ON sp.student_name = ha.student_name
      WHERE sp.user_id = auth.uid()
        AND ha.id::text = (storage.foldername(name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'homework-files'
  AND (
    public.is_staff_or_above(auth.uid())
    OR public.has_role(auth.uid(), 'instructor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.homework_assignments ha
      JOIN public.student_profiles sp ON sp.student_name = ha.student_name
      WHERE sp.user_id = auth.uid()
        AND ha.id::text = (storage.foldername(name))[1]
    )
  )
);

-- Also tighten INSERT (upload) policy with the same ownership check
DROP POLICY IF EXISTS "Authenticated users can upload homework files" ON storage.objects;

CREATE POLICY "Owner or staff can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework-files'
  AND (
    public.is_staff_or_above(auth.uid())
    OR public.has_role(auth.uid(), 'instructor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.homework_assignments ha
      JOIN public.student_profiles sp ON sp.student_name = ha.student_name
      WHERE sp.user_id = auth.uid()
        AND ha.id::text = (storage.foldername(name))[1]
    )
  )
);