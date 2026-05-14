ALTER TABLE public.class_sessions
ADD COLUMN IF NOT EXISTS is_urgent_makeup boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.class_sessions.is_urgent_makeup IS '예외(긴급) 사유로 신청된 보강 세션 여부. makeup_requests.urgent_reason이 있을 때 승인 시 true로 설정.';

-- Backfill: mark existing makeup sessions as urgent if linked approved request has urgent_reason
UPDATE public.class_sessions cs
SET is_urgent_makeup = true
WHERE cs.is_urgent_makeup = false
  AND EXISTS (
    SELECT 1
    FROM public.makeup_requests mr
    WHERE mr.status = 'approved'
      AND mr.urgent_reason IS NOT NULL
      AND mr.student_name = cs.student_name
      AND (
        -- match by reschedule_origin_dates contains the original date
        (mr.original_scheduled_at IS NOT NULL
          AND (mr.original_scheduled_at AT TIME ZONE 'Asia/Seoul')::date = ANY (cs.reschedule_origin_dates))
      )
  );