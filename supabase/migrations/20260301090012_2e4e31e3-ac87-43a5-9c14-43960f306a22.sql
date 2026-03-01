ALTER TABLE public.homework_assignments
DROP CONSTRAINT IF EXISTS homework_assignments_type_check;

ALTER TABLE public.homework_assignments
ADD CONSTRAINT homework_assignments_type_check
CHECK (
  type = ANY (
    ARRAY['writing'::text, 'reading'::text, 'speaking'::text, 'memorizing'::text, 'file'::text, 'watching'::text]
  )
);