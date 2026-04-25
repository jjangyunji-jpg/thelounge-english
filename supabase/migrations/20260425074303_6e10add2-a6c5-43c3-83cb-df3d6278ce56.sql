ALTER TABLE public.class_sessions
ADD COLUMN IF NOT EXISTS is_carryover boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_class_sessions_carryover
ON public.class_sessions (student_name, scheduled_at)
WHERE is_carryover = true;

COMMENT ON COLUMN public.class_sessions.is_carryover IS '강사-학생 협의로 다음 달로 이월된 세션 표시. 다음 달 결제 횟수에서 차감 계산에 사용됨.';