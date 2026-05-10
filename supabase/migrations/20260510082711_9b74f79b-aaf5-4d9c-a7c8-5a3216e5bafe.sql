
ALTER TABLE public.level_test_questions
  ADD COLUMN IF NOT EXISTS set_number integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_level_test_questions_test_set
  ON public.level_test_questions(level_test_id, set_number);

ALTER TABLE public.level_test_activations
  ADD COLUMN IF NOT EXISTS current_set integer NOT NULL DEFAULT 1;
