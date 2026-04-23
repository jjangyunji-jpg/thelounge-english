-- Replace per-material access with per-category (folder) access
CREATE TABLE public.teaching_category_instructors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, instructor_id)
);

CREATE INDEX idx_tci_category ON public.teaching_category_instructors(category);
CREATE INDEX idx_tci_instructor ON public.teaching_category_instructors(instructor_id);

ALTER TABLE public.teaching_category_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can manage category-instructor links"
ON public.teaching_category_instructors
FOR ALL TO authenticated
USING (public.is_manager_or_above(auth.uid()))
WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Staff can read category-instructor links"
ON public.teaching_category_instructors
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Instructors can read own category links"
ON public.teaching_category_instructors
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
);

-- Replace teaching_materials instructor SELECT policy with category-based gate
DROP POLICY IF EXISTS "Instructors can read assigned teaching_materials" ON public.teaching_materials;

CREATE POLICY "Instructors can read teaching_materials in assigned categories"
ON public.teaching_materials
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM public.teaching_category_instructors tci
    JOIN public.instructors i ON i.id = tci.instructor_id
    WHERE tci.category = teaching_materials.category
      AND i.user_id = auth.uid()
  )
);

-- Restrict teaching_material_categories list to assigned categories for instructors
DROP POLICY IF EXISTS "Instructors can read categories" ON public.teaching_material_categories;

CREATE POLICY "Instructors can read assigned categories"
ON public.teaching_material_categories
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.teaching_category_instructors tci
    JOIN public.instructors i ON i.id = tci.instructor_id
    WHERE tci.category = teaching_material_categories.slug
      AND i.user_id = auth.uid()
  )
);

-- Drop the old per-material mapping (no longer used)
DROP TABLE IF EXISTS public.teaching_material_instructors;