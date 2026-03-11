
-- Allow staff to INSERT teaching_materials
CREATE POLICY "Staff can insert teaching_materials"
ON public.teaching_materials
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Allow staff to UPDATE teaching_materials
CREATE POLICY "Staff can update teaching_materials"
ON public.teaching_materials
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'staff'::app_role));

-- Allow staff to DELETE teaching_materials
CREATE POLICY "Staff can delete teaching_materials"
ON public.teaching_materials
FOR DELETE
TO public
USING (has_role(auth.uid(), 'staff'::app_role));

-- Allow staff to INSERT teaching_material_categories
CREATE POLICY "Staff can insert categories"
ON public.teaching_material_categories
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Allow staff to UPDATE teaching_material_categories
CREATE POLICY "Staff can update categories"
ON public.teaching_material_categories
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'staff'::app_role));

-- Allow staff to DELETE teaching_material_categories
CREATE POLICY "Staff can delete categories"
ON public.teaching_material_categories
FOR DELETE
TO public
USING (has_role(auth.uid(), 'staff'::app_role));
