
-- Create feedback categories table for dynamic survey items
CREATE TABLE public.feedback_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all feedback_categories" ON public.feedback_categories FOR ALL USING (true) WITH CHECK (true);

-- Seed with current hardcoded categories
INSERT INTO public.feedback_categories (key, label, description, sort_order) VALUES
  ('satisfaction', '수업 만족도', '전반적인 수업에 대한 만족도를 평가해주세요', 0),
  ('teaching_quality', '수업 퀄리티', '수업 내용과 진행 방식의 질을 평가해주세요', 1),
  ('communication', '의사소통', '강사와의 소통이 원활했는지 평가해주세요', 2),
  ('lesson_preparation', '수업 준비도', '강사의 수업 준비 정도를 평가해주세요', 3);

-- Add ratings JSONB column to class_feedback for dynamic category support
ALTER TABLE public.class_feedback ADD COLUMN ratings jsonb DEFAULT NULL;
