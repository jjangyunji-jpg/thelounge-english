
-- ══════════════════════════════════════════════════════════════
-- 1. CLASS SESSIONS — 수업 세션 (노트 포함)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.class_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name   TEXT NOT NULL,
  instructor_name TEXT NOT NULL,
  level          TEXT NOT NULL DEFAULT 'B1',
  topic          TEXT,
  scheduled_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at     TIMESTAMP WITH TIME ZONE,
  ended_at       TIMESTAMP WITH TIME ZONE,
  notes          TEXT,
  meet_link      TEXT,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 2. HOMEWORK ASSIGNMENTS — 숙제 항목 (강사 생성)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.homework_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('writing', 'recording', 'reading')),
  title        TEXT NOT NULL,
  description  TEXT,
  is_preset    BOOLEAN NOT NULL DEFAULT false,
  due_at       TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 3. HOMEWORK SUBMISSIONS — 학생 제출물
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.homework_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  text_content    TEXT,
  audio_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'reviewed', 'needs_revision')),
  instructor_note TEXT,
  submitted_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMP WITH TIME ZONE
);

-- ══════════════════════════════════════════════════════════════
-- 4. VOCABULARY WORDS — 수업별 단어 목록 (TTS 캐시 포함)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.vocabulary_words (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_name     TEXT NOT NULL,
  week_label       TEXT NOT NULL,   -- e.g. "2026-W08"
  english_word     TEXT NOT NULL,
  korean_meaning   TEXT NOT NULL,
  part_of_speech   TEXT,
  example_sentence TEXT,
  audio_url        TEXT,            -- ElevenLabs TTS 캐시 URL
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 5. VOCABULARY TESTS — 테스트 세션
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.vocabulary_tests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('weekly', 'monthly')),
  week_label   TEXT,
  word_ids     UUID[],              -- 출제된 단어 ID 배열
  score        INTEGER,
  total        INTEGER,
  started_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ══════════════════════════════════════════════════════════════
-- 6. VOCABULARY TEST RESULTS — 단어별 답안
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.vocabulary_test_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        UUID REFERENCES public.vocabulary_tests(id) ON DELETE CASCADE,
  word_id        UUID REFERENCES public.vocabulary_words(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct     BOOLEAN,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 7. TIMESTAMPS TRIGGER
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- 8. STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('homework-audio', 'homework-audio', true, 20971520,
   ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']),
  ('vocab-audio',    'vocab-audio',    true, 5242880,
   ARRAY['audio/mpeg', 'audio/mp3']);

-- Storage 공개 읽기 정책
CREATE POLICY "Public read homework-audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'homework-audio');

CREATE POLICY "Public insert homework-audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'homework-audio');

CREATE POLICY "Public read vocab-audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vocab-audio');

CREATE POLICY "Public insert vocab-audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vocab-audio');

-- ══════════════════════════════════════════════════════════════
-- 9. 인덱스
-- ══════════════════════════════════════════════════════════════
CREATE INDEX idx_class_sessions_student ON public.class_sessions(student_name);
CREATE INDEX idx_homework_assignments_session ON public.homework_assignments(session_id);
CREATE INDEX idx_homework_submissions_assignment ON public.homework_submissions(assignment_id);
CREATE INDEX idx_vocabulary_words_session ON public.vocabulary_words(session_id);
CREATE INDEX idx_vocabulary_words_student_week ON public.vocabulary_words(student_name, week_label);
CREATE INDEX idx_vocabulary_tests_student ON public.vocabulary_tests(student_name);
