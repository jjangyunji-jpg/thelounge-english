
-- RLS 활성화 (내부 도구용 — 전체 허용 정책)
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_test_results ENABLE ROW LEVEL SECURITY;

-- 전체 허용 정책 (인증 없는 내부 관리 도구)
CREATE POLICY "Allow all class_sessions" ON public.class_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all homework_assignments" ON public.homework_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all homework_submissions" ON public.homework_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vocabulary_words" ON public.vocabulary_words FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vocabulary_tests" ON public.vocabulary_tests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vocabulary_test_results" ON public.vocabulary_test_results FOR ALL USING (true) WITH CHECK (true);
