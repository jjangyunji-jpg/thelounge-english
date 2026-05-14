
-- ============================================================
-- 1) Level test questions: 정답 컬럼 학생 노출 차단
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read level test questions" ON public.level_test_questions;

CREATE POLICY "Manager or instructor can read level test questions"
ON public.level_test_questions FOR SELECT TO authenticated
USING (
  public.is_manager_or_above(auth.uid())
  OR public.has_role(auth.uid(), 'instructor'::public.app_role)
);

CREATE OR REPLACE VIEW public.level_test_questions_safe
WITH (security_invoker = on) AS
SELECT id, level_test_id, set_number, category, question, choices, is_active, created_at, updated_at
FROM public.level_test_questions
WHERE is_active = true;

GRANT SELECT ON public.level_test_questions_safe TO authenticated;

-- ============================================================
-- 2) Homework files bucket: 공개 → 비공개 전환
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'homework-files';

-- 기존 SELECT/UPDATE 정책 정리 (정확한 이름 매칭 + 광범위 추적)
DROP POLICY IF EXISTS "Anyone can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Public homework files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public access to homework files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read homework files" ON storage.objects;
DROP POLICY IF EXISTS "Owner or staff can read homework files" ON storage.objects;

-- SELECT: 학생은 자기 과제 파일만, 강사·스태프는 전체
CREATE POLICY "Owner or staff can read homework files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    public.is_staff_or_above(auth.uid())
    OR public.has_role(auth.uid(), 'instructor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.homework_assignments ha
      JOIN public.student_profiles sp ON sp.user_id = auth.uid()
      WHERE ha.id::text = (storage.foldername(name))[1]
        AND ha.student_name = sp.student_name
    )
  )
);
