CREATE TABLE public.store_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month text NOT NULL UNIQUE,
  amount integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can manage store rewards"
ON public.store_rewards
FOR ALL
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Staff can read store rewards"
ON public.store_rewards
FOR SELECT
TO authenticated
USING (is_staff_or_above(auth.uid()));

CREATE TRIGGER update_store_rewards_updated_at
BEFORE UPDATE ON public.store_rewards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();