
-- holiday_notices INSERT/UPDATE/DELETE 정책을 다른 테이블과 동일하게 수정
DROP POLICY IF EXISTS "Admins can insert holiday notices" ON public.holiday_notices;
DROP POLICY IF EXISTS "Admins can update holiday notices" ON public.holiday_notices;
DROP POLICY IF EXISTS "Admins can delete holiday notices" ON public.holiday_notices;
DROP POLICY IF EXISTS "Anyone can read holiday notices" ON public.holiday_notices;

CREATE POLICY "Allow all holiday_notices"
ON public.holiday_notices FOR ALL
USING (true)
WITH CHECK (true);
