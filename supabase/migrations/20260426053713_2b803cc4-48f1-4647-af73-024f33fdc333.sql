CREATE TABLE public.instructor_calendar_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_name text NOT NULL UNIQUE,
  gcal_calendar_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructor_calendar_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read instructor calendar mapping"
ON public.instructor_calendar_mapping FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manager can manage instructor calendar mapping"
ON public.instructor_calendar_mapping FOR ALL TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE TRIGGER update_instructor_calendar_mapping_updated_at
BEFORE UPDATE ON public.instructor_calendar_mapping
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.instructor_calendar_mapping (instructor_name, gcal_calendar_id)
VALUES ('Reina', 'c_b613a8fa91e0b1f222e57f28a0dbc8dab60da9a64b15f85c08e4aacb39094a75@group.calendar.google.com');