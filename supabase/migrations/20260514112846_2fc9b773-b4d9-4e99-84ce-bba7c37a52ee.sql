
-- ============================================================
-- Stage 2: Cross-student data leakage 차단 (RLS 재설계)
-- 원칙: instructor/staff/manager는 기존대로 전체 접근,
--      학생은 본인(또는 그룹 멤버) 데이터만 SELECT 가능
-- 데이터 삭제 없음, 롤백 가능 (정책만 교체)
-- ============================================================

-- 헬퍼: 이 학생 데이터를 볼 수 있는가?
-- (스태프/매니저/강사 OR 본인 OR 그룹 멤버)
CREATE OR REPLACE FUNCTION public.can_view_student_data(_student_name text, _group_students text[] DEFAULT '{}'::text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_staff_or_above(auth.uid())
    OR public.has_role(auth.uid(), 'instructor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.student_profiles sp
      WHERE sp.user_id = auth.uid()
        AND (sp.student_name = _student_name
             OR sp.student_name = ANY(COALESCE(_group_students, '{}'::text[])))
    )
$$;

-- ------------------------------------------------------------
-- 1) instructors: 학생에게 전체 컬럼 노출 → 안전한 컬럼만 보이는 뷰로 분리
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Student can view own assigned instructor" ON public.instructors;

CREATE OR REPLACE VIEW public.instructors_public
WITH (security_invoker = on) AS
SELECT id, user_id, name, english_name, meet_link, active, position
FROM public.instructors;

GRANT SELECT ON public.instructors_public TO authenticated, anon;

-- ------------------------------------------------------------
-- 2) instructor_students: 학생에게 모든 학생 PII 노출 차단
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read instructor students" ON public.instructor_students;

CREATE POLICY "Staff/instructor/owner can read instructor students"
ON public.instructor_students FOR SELECT TO authenticated
USING (
  public.is_staff_or_above(auth.uid())
  OR public.has_role(auth.uid(), 'instructor'::public.app_role)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
      AND (sp.student_name = instructor_students.student_name
           OR sp.student_name = ANY(instructor_students.group_students))
  )
);

-- ------------------------------------------------------------
-- 3) class_sessions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read sessions" ON public.class_sessions;

CREATE POLICY "Staff/instructor/owner can read sessions"
ON public.class_sessions FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name, group_students));

-- ------------------------------------------------------------
-- 4) class_session_note_versions: session_id로 조인
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read note versions" ON public.class_session_note_versions;

CREATE POLICY "Staff/instructor/owner can read note versions"
ON public.class_session_note_versions FOR SELECT TO authenticated
USING (
  public.is_staff_or_above(auth.uid())
  OR public.has_role(auth.uid(), 'instructor'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.class_sessions cs
    JOIN public.student_profiles sp ON sp.user_id = auth.uid()
    WHERE cs.id = class_session_note_versions.session_id
      AND (sp.student_name = cs.student_name
           OR sp.student_name = ANY(cs.group_students))
  )
);

-- ------------------------------------------------------------
-- 5) homework_assignments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read assignments" ON public.homework_assignments;

CREATE POLICY "Staff/instructor/owner can read assignments"
ON public.homework_assignments FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 6) homework_submissions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read submissions" ON public.homework_submissions;

CREATE POLICY "Staff/instructor/owner can read submissions"
ON public.homework_submissions FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 7) instructor_student_feedback
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read instructor student feedback" ON public.instructor_student_feedback;

CREATE POLICY "Staff/instructor/owner can read instructor student feedback"
ON public.instructor_student_feedback FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 8) student_reports
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read student reports" ON public.student_reports;
DROP POLICY IF EXISTS "Authenticated can view student reports" ON public.student_reports;

CREATE POLICY "Staff/instructor/owner can read student reports"
ON public.student_reports FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 9) level_test_attempts
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read attempts" ON public.level_test_attempts;

CREATE POLICY "Staff/instructor/owner can read attempts"
ON public.level_test_attempts FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 10) key_expression_test_results
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read expression test results" ON public.key_expression_test_results;

CREATE POLICY "Staff/instructor/owner can read expression test results"
ON public.key_expression_test_results FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 11) vocabulary_tests
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read vocabulary tests" ON public.vocabulary_tests;
DROP POLICY IF EXISTS "Authenticated can read vocab tests" ON public.vocabulary_tests;

CREATE POLICY "Staff/instructor/owner can read vocabulary tests"
ON public.vocabulary_tests FOR SELECT TO authenticated
USING (public.can_view_student_data(student_name));

-- ------------------------------------------------------------
-- 12) vocabulary_test_results: test_id로 조인
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read vocabulary test results" ON public.vocabulary_test_results;
DROP POLICY IF EXISTS "Authenticated can read vocab test results" ON public.vocabulary_test_results;

CREATE POLICY "Staff/instructor/owner can read vocabulary test results"
ON public.vocabulary_test_results FOR SELECT TO authenticated
USING (
  public.is_staff_or_above(auth.uid())
  OR public.has_role(auth.uid(), 'instructor'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.vocabulary_tests vt
    JOIN public.student_profiles sp ON sp.user_id = auth.uid()
    WHERE vt.id = vocabulary_test_results.test_id
      AND sp.student_name = vt.student_name
  )
);
