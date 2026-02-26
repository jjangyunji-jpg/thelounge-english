
CREATE TABLE public.word_lookup_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'B1',
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_word_lookup_cache_word_level ON public.word_lookup_cache (lower(word), level);

ALTER TABLE public.word_lookup_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read word cache" ON public.word_lookup_cache FOR SELECT USING (true);
CREATE POLICY "Service role can insert cache" ON public.word_lookup_cache FOR INSERT WITH CHECK (true);
