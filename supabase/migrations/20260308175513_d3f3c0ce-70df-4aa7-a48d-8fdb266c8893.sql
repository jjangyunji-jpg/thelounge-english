CREATE TABLE public.student_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_name text NOT NULL,
  student_name text NOT NULL,
  period_id uuid REFERENCES public.schedule_periods(id),
  period_label text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (instructor_name, student_name, period_id)
);

ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read student reports"
  ON public.student_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Instructor or admin can insert student reports"
  ON public.student_reports FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Instructor or admin can update student reports"
  ON public.student_reports FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Students can update own report read status"
  ON public.student_reports FOR UPDATE
  TO authenticated
  USING (student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()));