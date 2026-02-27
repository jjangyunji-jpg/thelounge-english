
-- Add file_url column to homework_submissions
ALTER TABLE public.homework_submissions ADD COLUMN file_url text;

-- Create homework-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('homework-files', 'homework-files', true);

-- Storage policies for homework-files
CREATE POLICY "Anyone can read homework files"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework-files');

CREATE POLICY "Authenticated users can upload homework files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'homework-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own homework files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'homework-files' AND auth.role() = 'authenticated');
