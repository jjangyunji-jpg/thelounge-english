
-- 강사 → 학생 월말 피드백 테이블
CREATE TABLE public.instructor_student_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_name text NOT NULL,
  student_name text NOT NULL,
  period_id uuid REFERENCES public.schedule_periods(id),
  period_label text NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{}',
  comment text,
  suggested_goals text,
  applied_goals boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instructor_name, student_name, period_id)
);

ALTER TABLE public.instructor_student_feedback ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 읽기 가능
CREATE POLICY "Authenticated can read instructor student feedback"
ON public.instructor_student_feedback FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- 강사 또는 관리자만 입력
CREATE POLICY "Instructor or admin can insert instructor student feedback"
ON public.instructor_student_feedback FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));

-- 강사 또는 관리자만 수정
CREATE POLICY "Instructor or admin can update instructor student feedback"
ON public.instructor_student_feedback FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));

-- 관리자만 삭제
CREATE POLICY "Admin can delete instructor student feedback"
ON public.instructor_student_feedback FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
