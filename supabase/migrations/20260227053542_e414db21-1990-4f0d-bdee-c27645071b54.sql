
-- Create junction table for meeting attendees (invited instructors)
CREATE TABLE public.business_meeting_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.business_meetings(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, instructor_id)
);

ALTER TABLE public.business_meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all business_meeting_attendees" ON public.business_meeting_attendees FOR ALL USING (true) WITH CHECK (true);
