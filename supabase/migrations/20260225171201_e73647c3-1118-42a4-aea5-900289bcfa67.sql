
-- 1. app_role enum에 'student' 추가
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';

-- 2. user_roles 테이블에 approved 컬럼 추가
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- 3. user_roles에 display_name 컬럼 추가 (가입 시 이름 저장)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS display_name text;

-- 4. 기존 admin/instructor 레코드는 자동 승인
UPDATE public.user_roles SET approved = true WHERE role IN ('admin', 'instructor');

-- 5. 인증된 사용자가 자신의 역할을 읽을 수 있는 정책은 이미 존재
-- 어드민이 승인 상태를 업데이트할 수 있는 정책 추가
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
