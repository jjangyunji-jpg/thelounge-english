-- Create homework-tts bucket for cached homework description audio (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-tts', 'homework-tts', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
CREATE POLICY "Public can read homework-tts"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework-tts');

-- Service role handles writes via edge function (no client-side write policy needed)
