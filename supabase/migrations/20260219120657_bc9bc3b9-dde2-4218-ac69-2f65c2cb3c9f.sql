
-- ── 1. Instructors table ────────────────────────────────────────────────────
CREATE TABLE public.instructors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  lesson_rate INTEGER NOT NULL DEFAULT 30000,   -- 원/시간
  meeting_rate INTEGER NOT NULL DEFAULT 20000,  -- 원/시간
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view all instructors"
  ON public.instructors FOR SELECT USING (true);

CREATE POLICY "Only authenticated can update own instructor record"
  ON public.instructors FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 2. Instructor <-> Student mapping ───────────────────────────────────────
CREATE TABLE public.instructor_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instructor_id, student_name)
);

ALTER TABLE public.instructor_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read instructor_students"
  ON public.instructor_students FOR SELECT USING (true);

CREATE POLICY "Allow insert instructor_students"
  ON public.instructor_students FOR ALL USING (true) WITH CHECK (true);

-- ── 3. Business meetings table ───────────────────────────────────────────────
CREATE TABLE public.business_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all business_meetings"
  ON public.business_meetings FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Schedule periods table (variable billing period) ─────────────────────
CREATE TABLE public.schedule_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,          -- e.g. "2026년 2월 수업"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all schedule_periods"
  ON public.schedule_periods FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Add instructor_name column to class_sessions if not exists ─────────
-- (already exists as instructor_name TEXT, so no change needed)

-- ── 6. Trigger: updated_at for instructors ─────────────────────────────────
CREATE TRIGGER update_instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. Seed: sample schedule period ─────────────────────────────────────────
INSERT INTO public.schedule_periods (label, start_date, end_date, is_active)
VALUES ('2026년 2월 수업', '2026-02-01', '2026-03-04', true);

-- ── 8. Seed: sample instructors (no auth user linked yet) ───────────────────
INSERT INTO public.instructors (name, email, phone, lesson_rate, meeting_rate)
VALUES
  ('Sarah Kim', 'sarah.kim@loungeenglish.com', '010-1234-5678', 30000, 20000),
  ('James Park', 'james.park@loungeenglish.com', '010-2345-6789', 35000, 25000),
  ('Emily Lee', 'emily.lee@loungeenglish.com', '010-3456-7890', 28000, 18000);
