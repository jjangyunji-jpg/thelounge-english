
-- Allow substitute mirror sessions at same slot as cancelled original
DROP INDEX IF EXISTS public.uq_class_sessions_student_scheduled;
CREATE UNIQUE INDEX uq_class_sessions_student_scheduled
  ON public.class_sessions (student_name, scheduled_at)
  WHERE cancellation_type IS NULL;

-- Backfill missing substitute mirrors for 박윤정 (홍새롬, 우담비 on 6/21)
INSERT INTO public.class_sessions
  (student_name, instructor_name, scheduled_at, level, group_students,
   topic, notes, meet_link, is_substitute, substitute_direction, substitute_origin_session_id)
SELECT o.student_name, o.substitute_instructor, o.scheduled_at, o.level, o.group_students,
       o.topic, o.notes, o.meet_link, true, 'in', o.id
FROM public.class_sessions o
WHERE o.id IN ('ac9fac5a-e1aa-4545-b449-d2171a7206c8','773b4f00-e706-488f-99dd-6daf551b7a20')
  AND NOT EXISTS (
    SELECT 1 FROM public.class_sessions m WHERE m.substitute_origin_session_id = o.id
  );
