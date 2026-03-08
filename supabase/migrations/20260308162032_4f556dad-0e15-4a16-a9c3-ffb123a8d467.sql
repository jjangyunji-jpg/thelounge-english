CREATE TABLE public.curriculum_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.curriculum_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read curriculum guides"
  ON public.curriculum_guides FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can insert curriculum guides"
  ON public.curriculum_guides FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update curriculum guides"
  ON public.curriculum_guides FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete curriculum guides"
  ON public.curriculum_guides FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default rows for each level
INSERT INTO public.curriculum_guides (level, content) VALUES
  ('A1', ''),
  ('A2', ''),
  ('B1', ''),
  ('B2', ''),
  ('C1', ''),
  ('C2', '');

-- Trigger for updated_at
CREATE TRIGGER update_curriculum_guides_updated_at
  BEFORE UPDATE ON public.curriculum_guides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();