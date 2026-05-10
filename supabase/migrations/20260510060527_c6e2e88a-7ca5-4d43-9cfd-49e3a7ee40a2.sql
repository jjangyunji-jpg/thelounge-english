
-- 1) Level test definitions
CREATE TABLE public.level_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL,
  title text NOT NULL,
  description text,
  pass_threshold integer NOT NULL DEFAULT 80,
  question_count integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.level_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read level tests"
  ON public.level_tests FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager can manage level tests"
  ON public.level_tests FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

CREATE TRIGGER update_level_tests_updated_at
  BEFORE UPDATE ON public.level_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Question pool
CREATE TABLE public.level_test_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_test_id uuid NOT NULL REFERENCES public.level_tests(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  question text NOT NULL,
  choices jsonb NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_level_test_questions_test ON public.level_test_questions(level_test_id);
ALTER TABLE public.level_test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read level test questions"
  ON public.level_test_questions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager can manage level test questions"
  ON public.level_test_questions FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

CREATE TRIGGER update_level_test_questions_updated_at
  BEFORE UPDATE ON public.level_test_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Per-student activation by instructor
CREATE TABLE public.level_test_activations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name text NOT NULL,
  level_test_id uuid NOT NULL REFERENCES public.level_tests(id) ON DELETE CASCADE,
  activated_by text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  passed_at timestamptz,
  best_score integer NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  notes text,
  UNIQUE (student_name, level_test_id)
);
CREATE INDEX idx_level_test_activations_student ON public.level_test_activations(student_name);
ALTER TABLE public.level_test_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read activations"
  ON public.level_test_activations FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or manager can insert activations"
  ON public.level_test_activations FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructor or manager can update activations"
  ON public.level_test_activations FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructor or manager can delete activations"
  ON public.level_test_activations FOR DELETE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- 4) Attempts
CREATE TABLE public.level_test_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name text NOT NULL,
  level_test_id uuid NOT NULL REFERENCES public.level_tests(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_level_test_attempts_student ON public.level_test_attempts(student_name);
CREATE INDEX idx_level_test_attempts_test ON public.level_test_attempts(level_test_id);
ALTER TABLE public.level_test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read attempts"
  ON public.level_test_attempts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert attempts"
  ON public.level_test_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Manager can delete attempts"
  ON public.level_test_attempts FOR DELETE TO authenticated
  USING (is_manager_or_above(auth.uid()));

-- 5) Seed: A1 test
INSERT INTO public.level_tests (level, title, description, pass_threshold, question_count)
VALUES ('A1', 'A1 레벨 테스트', '진행형 / 현재형 / 미래형 / 과거형 / 현재완료(경험·계속) — 작문과 실제 사용 중심', 80, 15);
