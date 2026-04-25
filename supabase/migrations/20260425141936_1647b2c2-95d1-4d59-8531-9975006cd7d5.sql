-- Add carryover_direction to distinguish previous-month carryover vs next-month carryover
ALTER TABLE public.class_sessions
ADD COLUMN carryover_direction TEXT;

-- Backfill: existing is_carryover=true sessions are treated as 'prev' (carried in from previous month)
UPDATE public.class_sessions
SET carryover_direction = 'prev'
WHERE is_carryover = true;

-- Constraint: only allow specific values
ALTER TABLE public.class_sessions
ADD CONSTRAINT class_sessions_carryover_direction_check
CHECK (carryover_direction IS NULL OR carryover_direction IN ('prev', 'next'));