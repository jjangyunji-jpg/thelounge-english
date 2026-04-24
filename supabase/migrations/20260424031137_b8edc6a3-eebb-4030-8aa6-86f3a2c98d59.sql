-- Track session dates that were intentionally deleted (so virtual sessions don't reappear)
CREATE TABLE public.deleted_session_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  deleted_date DATE NOT NULL,
  deleted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_name, deleted_date)
);

CREATE INDEX idx_deleted_session_dates_student ON public.deleted_session_dates(student_name);

ALTER TABLE public.deleted_session_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read deleted session dates"
ON public.deleted_session_dates FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Instructor or manager can insert deleted session dates"
ON public.deleted_session_dates FOR INSERT
TO authenticated
WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Instructor or manager can delete deleted session dates"
ON public.deleted_session_dates FOR DELETE
TO authenticated
USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- Trigger: when a class_session is deleted, record its KST date as "intentionally blanked"
CREATE OR REPLACE FUNCTION public.record_deleted_session_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kst_date DATE;
BEGIN
  kst_date := (OLD.scheduled_at AT TIME ZONE 'Asia/Seoul')::date;
  INSERT INTO public.deleted_session_dates (student_name, deleted_date, deleted_by)
  VALUES (OLD.student_name, kst_date, auth.uid())
  ON CONFLICT (student_name, deleted_date) DO NOTHING;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_record_deleted_session_date
AFTER DELETE ON public.class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.record_deleted_session_date();

-- Trigger: if a new session is created on the same date, remove the "blanked" marker
CREATE OR REPLACE FUNCTION public.clear_deleted_session_date_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kst_date DATE;
BEGIN
  kst_date := (NEW.scheduled_at AT TIME ZONE 'Asia/Seoul')::date;
  DELETE FROM public.deleted_session_dates
  WHERE student_name = NEW.student_name AND deleted_date = kst_date;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clear_deleted_session_date_on_insert
AFTER INSERT ON public.class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.clear_deleted_session_date_on_insert();