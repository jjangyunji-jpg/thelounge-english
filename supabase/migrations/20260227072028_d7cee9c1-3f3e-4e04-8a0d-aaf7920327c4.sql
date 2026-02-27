
-- Teaching materials table for Book Talk and other lesson resources
CREATE TABLE public.teaching_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'book_talk',
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teaching_materials ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage teaching_materials"
ON public.teaching_materials FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Instructors can read active materials
CREATE POLICY "Instructors can read teaching_materials"
ON public.teaching_materials FOR SELECT
USING (has_role(auth.uid(), 'instructor') AND is_active = true);

-- Auto-update updated_at
CREATE TRIGGER update_teaching_materials_updated_at
BEFORE UPDATE ON public.teaching_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
