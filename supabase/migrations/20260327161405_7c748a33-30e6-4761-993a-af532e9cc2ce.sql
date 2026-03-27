
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL DEFAULT 'all',
  subject text NOT NULL,
  body text NOT NULL,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can manage notifications"
  ON public.admin_notifications FOR ALL
  TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Staff can read notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));
