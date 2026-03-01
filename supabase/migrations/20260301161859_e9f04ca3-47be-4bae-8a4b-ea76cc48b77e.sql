
-- 1. 어드민용 장기 목표 (등록 계기/최종 목표) 필드 추가
ALTER TABLE public.instructor_students
ADD COLUMN learning_objective text;

-- 2. 기존 lesson_goal 데이터 중 어드민이 설정한 것을 learning_objective로 복사
-- (안전하게: lesson_goal 값이 있으면 learning_objective에도 복사)
UPDATE public.instructor_students
SET learning_objective = lesson_goal
WHERE lesson_goal IS NOT NULL;

-- 3. lesson_goal_count 컬럼 제거
ALTER TABLE public.instructor_students
DROP COLUMN lesson_goal_count;
