
ALTER TABLE public.class_sessions
ADD COLUMN IF NOT EXISTS is_makeup boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.class_sessions.is_makeup IS '보강 요청(makeup_requests) 승인으로 생성/이동된 세션 여부. 강사 단순 일정 변경은 false 유지.';

UPDATE public.class_sessions cs
SET is_makeup = true
WHERE cs.is_makeup = false
  AND EXISTS (
    SELECT 1 FROM public.makeup_requests mr
    WHERE mr.status = 'approved'
      AND mr.student_name = cs.student_name
      AND mr.original_scheduled_at IS NOT NULL
      AND (mr.original_scheduled_at AT TIME ZONE 'Asia/Seoul')::date = ANY (cs.reschedule_origin_dates)
  );

-- Urgent makeup rows are makeups by definition
UPDATE public.class_sessions
SET is_makeup = true
WHERE is_makeup = false AND is_urgent_makeup = true;
