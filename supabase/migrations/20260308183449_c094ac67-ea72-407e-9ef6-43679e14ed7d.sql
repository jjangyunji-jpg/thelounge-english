
-- 1. Instructor available slots
CREATE TABLE public.instructor_available_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  instructor_name text NOT NULL,
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instructor_id, slot_date, slot_time)
);

ALTER TABLE public.instructor_available_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read slots" ON public.instructor_available_slots FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert slots" ON public.instructor_available_slots FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructor or admin can update slots" ON public.instructor_available_slots FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructor or admin can delete slots" ON public.instructor_available_slots FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));

-- 2. Makeup requests
CREATE TABLE public.makeup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  instructor_name text NOT NULL,
  original_session_id uuid REFERENCES public.class_sessions(id),
  slot_id uuid NOT NULL REFERENCES public.instructor_available_slots(id),
  request_type text NOT NULL DEFAULT 'reschedule',
  status text NOT NULL DEFAULT 'pending',
  group_students text[] NOT NULL DEFAULT '{}'::text[],
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.makeup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read makeup requests" ON public.makeup_requests FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert makeup requests" ON public.makeup_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can update makeup requests" ON public.makeup_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Student can cancel own pending requests" ON public.makeup_requests FOR UPDATE TO authenticated USING (
  student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()) AND status = 'pending'
) WITH CHECK (
  student_name IN (SELECT sp.student_name FROM student_profiles sp WHERE sp.user_id = auth.uid()) AND status = 'cancelled'
);
