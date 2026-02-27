
-- Create teaching material categories table
CREATE TABLE public.teaching_material_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teaching_material_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage categories" ON public.teaching_material_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can read categories" ON public.teaching_material_categories
  FOR SELECT USING (has_role(auth.uid(), 'instructor'::app_role));

-- Seed existing category
INSERT INTO public.teaching_material_categories (name, slug, sort_order) VALUES ('Book Talk', 'book_talk', 0);
