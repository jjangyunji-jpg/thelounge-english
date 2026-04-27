ALTER TABLE public.makeup_requests
  ADD COLUMN IF NOT EXISTS urgent_reason text,
  ADD COLUMN IF NOT EXISTS rejection_code text;

COMMENT ON COLUMN public.makeup_requests.urgent_reason IS '긴급 보강 사유 코드: meeting | health | family';
COMMENT ON COLUMN public.makeup_requests.rejection_code IS '거절 사유 코드: within_48h | not_urgent | no_slots | repeated_change';