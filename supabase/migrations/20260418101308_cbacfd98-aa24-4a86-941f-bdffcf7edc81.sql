-- Key Expressions (Sentence Bank) tables

CREATE TABLE public.key_expressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  session_id UUID,
  situation_label TEXT NOT NULL DEFAULT '',
  english TEXT NOT NULL,
  korean TEXT NOT NULL,
  created_by_instructor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_key_expressions_student_name ON public.key_expressions(student_name);
CREATE INDEX idx_key_expressions_session_id ON public.key_expressions(session_id);

ALTER TABLE public.key_expressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read key_expressions"
  ON public.key_expressions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Instructor or manager can insert key_expressions"
  ON public.key_expressions FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Instructor or manager can update key_expressions"
  ON public.key_expressions FOR UPDATE
  TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Instructor or manager can delete key_expressions"
  ON public.key_expressions FOR DELETE
  TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE TRIGGER update_key_expressions_updated_at
  BEFORE UPDATE ON public.key_expressions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Test results
CREATE TABLE public.key_expression_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expression_id UUID NOT NULL REFERENCES public.key_expressions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  ai_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_key_expression_test_results_student ON public.key_expression_test_results(student_name);
CREATE INDEX idx_key_expression_test_results_expression ON public.key_expression_test_results(expression_id);

ALTER TABLE public.key_expression_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read expression test results"
  ON public.key_expression_test_results FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert expression test results"
  ON public.key_expression_test_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manager can delete expression test results"
  ON public.key_expression_test_results FOR DELETE
  TO authenticated
  USING (is_manager_or_above(auth.uid()));