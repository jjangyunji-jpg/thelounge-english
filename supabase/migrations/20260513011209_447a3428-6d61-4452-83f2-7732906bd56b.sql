-- 1) Add columns
ALTER TABLE public.instructor_students
  ADD COLUMN IF NOT EXISTS corporate_role text NOT NULL DEFAULT 'learner',
  ADD COLUMN IF NOT EXISTS corporate_account text;

ALTER TABLE public.instructor_students
  DROP CONSTRAINT IF EXISTS instructor_students_corporate_role_check;
ALTER TABLE public.instructor_students
  ADD CONSTRAINT instructor_students_corporate_role_check
  CHECK (corporate_role IN ('learner','manager','learner_manager'));

CREATE INDEX IF NOT EXISTS idx_instructor_students_corporate_account
  ON public.instructor_students (corporate_account);

-- 2) Data migration for existing corporate students
-- 전현지팀 (manager: 전현지, learners: 도은, 지아나, 선혜, 연정, 한지은)
UPDATE public.instructor_students
SET corporate_role = 'manager',
    corporate_account = '전현지팀',
    group_students = '{}'::text[]
WHERE student_name = '전현지';

UPDATE public.instructor_students
SET corporate_role = 'learner',
    corporate_account = '전현지팀',
    group_students = '{지아나}'::text[]
WHERE student_name = '도은';

UPDATE public.instructor_students
SET corporate_role = 'learner',
    corporate_account = '전현지팀',
    group_students = '{도은}'::text[]
WHERE student_name = '지아나';

UPDATE public.instructor_students
SET corporate_role = 'learner',
    corporate_account = '전현지팀',
    group_students = '{연정}'::text[]
WHERE student_name = '선혜';

UPDATE public.instructor_students
SET corporate_role = 'learner',
    corporate_account = '전현지팀',
    group_students = '{선혜}'::text[]
WHERE student_name = '연정';

UPDATE public.instructor_students
SET corporate_role = 'learner',
    corporate_account = '전현지팀',
    group_students = '{}'::text[]
WHERE student_name = '한지은';

-- 황재민팀 (manager: 김동욱, learner: 황재민 - 개인수업)
UPDATE public.instructor_students
SET corporate_role = 'manager',
    corporate_account = '황재민팀',
    group_students = '{}'::text[]
WHERE student_name = '김동욱';

UPDATE public.instructor_students
SET corporate_role = 'learner',
    corporate_account = '황재민팀',
    group_students = '{}'::text[]
WHERE student_name = '황재민';

-- 본인 매니저 (learner_manager)
UPDATE public.instructor_students
SET corporate_role = 'learner_manager',
    corporate_account = student_name,
    group_students = '{}'::text[]
WHERE student_name IN ('여환웅', '오의식');