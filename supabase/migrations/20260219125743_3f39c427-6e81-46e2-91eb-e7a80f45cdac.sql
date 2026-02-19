-- 특별 휴강 공지 테이블
CREATE TABLE public.holiday_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  reason text,
  notify_students boolean NOT NULL DEFAULT true,
  dismissed_by text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.holiday_notices ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (수강생 대시보드에서 팝업 표시)
CREATE POLICY "Anyone can read holiday notices"
ON public.holiday_notices FOR SELECT
USING (true);

-- 어드민만 쓰기 가능
CREATE POLICY "Admins can insert holiday notices"
ON public.holiday_notices FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update holiday notices"
ON public.holiday_notices FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete holiday notices"
ON public.holiday_notices FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
