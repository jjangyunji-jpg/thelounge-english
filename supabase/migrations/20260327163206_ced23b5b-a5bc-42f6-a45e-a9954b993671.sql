
ALTER TABLE public.admin_notifications ADD COLUMN read_by uuid[] NOT NULL DEFAULT '{}';

CREATE POLICY "Authenticated can update notification read_by"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can read notifications targeted to them"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
