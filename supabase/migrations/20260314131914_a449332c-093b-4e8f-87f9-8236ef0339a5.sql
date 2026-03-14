ALTER TABLE public.homework_assignments 
  ADD COLUMN preset_origin_id uuid REFERENCES public.homework_assignments(id) ON DELETE SET NULL;