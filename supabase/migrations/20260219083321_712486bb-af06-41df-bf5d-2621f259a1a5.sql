
-- 기존 'writing', 'recording', 'reading' 타입 데이터를 새 타입으로 업데이트
UPDATE public.homework_assignments SET type = 'writing' WHERE type IN ('writing', 'text');
UPDATE public.homework_assignments SET type = 'reading' WHERE type = 'recording';

-- type 컬럼의 check constraint를 4가지 타입으로 교체
ALTER TABLE public.homework_assignments
  DROP CONSTRAINT IF EXISTS homework_assignments_type_check;

ALTER TABLE public.homework_assignments
  ADD CONSTRAINT homework_assignments_type_check
  CHECK (type IN ('writing', 'reading', 'speaking', 'memorizing'));
