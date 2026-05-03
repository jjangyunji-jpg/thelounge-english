CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  label text NOT NULL DEFAULT '',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_api_keys_student ON public.api_keys(student_name);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can manage api keys"
ON public.api_keys FOR ALL
TO authenticated
USING (public.is_manager_or_above(auth.uid()))
WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Students can read own api keys metadata"
ON public.api_keys FOR SELECT
TO authenticated
USING (student_name IN (
  SELECT sp.student_name FROM public.student_profiles sp WHERE sp.user_id = auth.uid()
));