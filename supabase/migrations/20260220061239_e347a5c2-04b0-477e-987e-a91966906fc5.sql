-- 학생 프로필 테이블 (auth.user_id ↔ student_name 매핑)
CREATE TABLE public.student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  student_name text NOT NULL,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필 조회
CREATE POLICY "Students can view own profile"
ON public.student_profiles FOR SELECT
USING (auth.uid() = user_id);

-- 본인 프로필 최초 생성 (계정 설정 시)
CREATE POLICY "Students can insert own profile"
ON public.student_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 본인 프로필 수정 (닉네임 변경 등)
CREATE POLICY "Students can update own profile"
ON public.student_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- 어드민 전체 관리
CREATE POLICY "Admins can manage student profiles"
ON public.student_profiles FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- updated_at 자동 갱신
CREATE TRIGGER update_student_profiles_updated_at
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();