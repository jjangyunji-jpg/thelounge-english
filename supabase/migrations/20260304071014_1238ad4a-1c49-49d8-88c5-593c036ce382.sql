
CREATE TABLE public.support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bug',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own requests"
ON public.support_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own requests"
ON public.support_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all requests"
ON public.support_requests FOR ALL
USING (public.has_role(auth.uid(), 'admin'));
