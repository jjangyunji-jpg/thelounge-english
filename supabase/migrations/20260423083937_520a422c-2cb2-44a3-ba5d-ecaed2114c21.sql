-- Per-material instructor access mapping
CREATE TABLE public.teaching_material_instructors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id uuid NOT NULL REFERENCES public.teaching_materials(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, instructor_id)
);

CREATE INDEX idx_tmi_material ON public.teaching_material_instructors(material_id);
CREATE INDEX idx_tmi_instructor ON public.teaching_material_instructors(instructor_id);

ALTER TABLE public.teaching_material_instructors ENABLE ROW LEVEL SECURITY;

-- Managers full control
CREATE POLICY "Manager can manage material-instructor links"
ON public.teaching_material_instructors
FOR ALL TO authenticated
USING (public.is_manager_or_above(auth.uid()))
WITH CHECK (public.is_manager_or_above(auth.uid()));

-- Staff read
CREATE POLICY "Staff can read material-instructor links"
ON public.teaching_material_instructors
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'staff'::app_role));

-- Instructors can read their own access rows (to know what they have access to)
CREATE POLICY "Instructors can read own material links"
ON public.teaching_material_instructors
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
);

-- Replace existing instructor SELECT policy on teaching_materials with restricted version
DROP POLICY IF EXISTS "Instructors can read teaching_materials" ON public.teaching_materials;

CREATE POLICY "Instructors can read assigned teaching_materials"
ON public.teaching_materials
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM public.teaching_material_instructors tmi
    JOIN public.instructors i ON i.id = tmi.instructor_id
    WHERE tmi.material_id = teaching_materials.id
      AND i.user_id = auth.uid()
  )
);