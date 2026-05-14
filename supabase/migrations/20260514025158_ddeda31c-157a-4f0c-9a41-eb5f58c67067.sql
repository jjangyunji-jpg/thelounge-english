CREATE TABLE public.student_lesson_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  goal text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_lesson_goals_lookup
  ON public.student_lesson_goals (student_name, effective_from DESC);

ALTER TABLE public.student_lesson_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read student lesson goals"
  ON public.student_lesson_goals FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Instructor or manager can insert student lesson goals"
  ON public.student_lesson_goals FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Instructor or manager can update student lesson goals"
  ON public.student_lesson_goals FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Manager can delete student lesson goals"
  ON public.student_lesson_goals FOR DELETE TO authenticated
  USING (is_manager_or_above(auth.uid()));