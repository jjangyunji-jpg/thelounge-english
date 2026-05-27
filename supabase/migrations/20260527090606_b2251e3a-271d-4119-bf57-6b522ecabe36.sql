ALTER TABLE public.makeup_requests
  DROP CONSTRAINT makeup_requests_original_session_id_fkey,
  ADD CONSTRAINT makeup_requests_original_session_id_fkey
    FOREIGN KEY (original_session_id) REFERENCES public.class_sessions(id) ON DELETE SET NULL;