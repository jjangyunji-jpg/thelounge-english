
CREATE TABLE public.student_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  -- Section 1: 영어 공부 이유와 목적
  study_reason TEXT[],
  study_goal TEXT,
  study_trigger TEXT,
  -- Section 2: 학습 선호도
  preferred_methods TEXT[],
  past_methods TEXT,
  disliked_methods TEXT,
  -- Section 3: 관심 분야 및 현재 상황
  interest_topics TEXT[],
  english_usage_frequency TEXT,
  additional_note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_surveys ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/update their own survey
CREATE POLICY "Users can manage own survey"
  ON public.student_surveys FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin full access
CREATE POLICY "Admin full access to surveys"
  ON public.student_surveys FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
