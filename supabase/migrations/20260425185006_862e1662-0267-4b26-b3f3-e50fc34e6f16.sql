ALTER TABLE public.instructor_students 
ADD COLUMN IF NOT EXISTS corporate_rate integer,
ADD COLUMN IF NOT EXISTS tax_invoice boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instructor_students.corporate_rate IS 'Per-session rate for corporate students (overrides default 50,000). Only used when student_type = corporate.';
COMMENT ON COLUMN public.instructor_students.tax_invoice IS 'Default payment method for corporate students: true = 계산서 발급 (full amount), false = 사업소득 3.3% 공제';