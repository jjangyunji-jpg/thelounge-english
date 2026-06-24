-- Allow students to create per-session homework assignment copies for themselves.
-- This unblocks resolveCanonicalSubmissionTarget which needs to create a
-- session-copy from a preset master when a student submits and no copy yet
-- exists for their upcoming/most-recent session.
--
-- Safety guards in WITH CHECK:
--   * is_preset must be false (students cannot create preset masters)
--   * preset_origin_id must point to an existing preset master row
--   * student_name must match the caller's own student_profiles entry
--   * session_id must reference a class_sessions row that belongs to the
--     same student (no creating copies on someone else's session)
CREATE POLICY "Students can insert own session-copy assignments"
ON public.homework_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  is_preset = false
  AND preset_origin_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.homework_assignments p
    WHERE p.id = homework_assignments.preset_origin_id
      AND p.is_preset = true
  )
  AND student_name IN (
    SELECT sp.student_name FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
  )
  AND (
    session_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.class_sessions cs
      WHERE cs.id = homework_assignments.session_id
        AND (
          cs.student_name = homework_assignments.student_name
          OR cs.group_students @> ARRAY[homework_assignments.student_name]
        )
    )
  )
);
