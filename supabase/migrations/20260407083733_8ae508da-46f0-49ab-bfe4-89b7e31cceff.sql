-- Add cancellation_resolution to track follow-up action for cancelled sessions
ALTER TABLE public.class_sessions
ADD COLUMN cancellation_resolution text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.class_sessions.cancellation_resolution IS 'Follow-up action for cancelled sessions: makeup, carry_over, refund';