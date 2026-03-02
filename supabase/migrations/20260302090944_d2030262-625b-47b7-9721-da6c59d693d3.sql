
-- Guide documents (PDF files by category)
CREATE TABLE public.guide_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '일반',
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage guide_documents"
  ON public.guide_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can read guide_documents"
  ON public.guide_documents FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role));

-- Guide FAQs
CREATE TABLE public.guide_faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '일반',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage guide_faqs"
  ON public.guide_faqs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can read guide_faqs"
  ON public.guide_faqs FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role));

-- Storage bucket for guide PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('guide-files', 'guide-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload guide files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'guide-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete guide files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'guide-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read guide files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'guide-files');
