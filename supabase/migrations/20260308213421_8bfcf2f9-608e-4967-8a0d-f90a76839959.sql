
CREATE TABLE public.waitlist_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  phone TEXT,
  desired_level TEXT,
  preferred_schedule TEXT,
  note TEXT,
  queue_number SERIAL,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Users can read their own waitlist entry
CREATE POLICY "Users can read own waitlist entry"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can read queue numbers of all waiting entries (for queue position)
CREATE POLICY "Users can see waiting queue"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (status = 'waiting');

-- Admin can do everything
CREATE POLICY "Admin full access to waitlist"
  ON public.waitlist_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
