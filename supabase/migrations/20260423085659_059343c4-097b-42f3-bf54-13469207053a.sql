-- Add level tag and archived flag to teaching_material_categories
ALTER TABLE public.teaching_material_categories
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tmc_level ON public.teaching_material_categories(level);
CREATE INDEX IF NOT EXISTS idx_tmc_archived ON public.teaching_material_categories(is_archived);

-- Hide archived categories from instructors (managers still see all via manage policy)
DROP POLICY IF EXISTS "Instructors can read assigned categories" ON public.teaching_material_categories;

CREATE POLICY "Instructors can read assigned categories"
ON public.teaching_material_categories
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND is_archived = false
  AND EXISTS (
    SELECT 1 FROM public.teaching_category_instructors tci
    JOIN public.instructors i ON i.id = tci.instructor_id
    WHERE tci.category = teaching_material_categories.slug
      AND i.user_id = auth.uid()
  )
);

-- Hide materials in archived categories from instructors
DROP POLICY IF EXISTS "Instructors can read teaching_materials in assigned categories" ON public.teaching_materials;

CREATE POLICY "Instructors can read teaching_materials in assigned categories"
ON public.teaching_materials
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM public.teaching_material_categories tmc
    WHERE tmc.slug = teaching_materials.category
      AND tmc.is_archived = false
  )
  AND EXISTS (
    SELECT 1 FROM public.teaching_category_instructors tci
    JOIN public.instructors i ON i.id = tci.instructor_id
    WHERE tci.category = teaching_materials.category
      AND i.user_id = auth.uid()
  )
);