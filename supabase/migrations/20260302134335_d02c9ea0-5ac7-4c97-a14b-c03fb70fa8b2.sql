-- Track manually rescheduled original dates to prevent regenerate duplicates
ALTER TABLE public.class_sessions
ADD COLUMN IF NOT EXISTS reschedule_origin_dates date[] NOT NULL DEFAULT '{}'::date[];

CREATE OR REPLACE FUNCTION public.track_class_session_reschedule_origins()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only record when the KST calendar date actually changes
  IF (NEW.scheduled_at AT TIME ZONE 'Asia/Seoul')::date IS DISTINCT FROM (OLD.scheduled_at AT TIME ZONE 'Asia/Seoul')::date THEN
    NEW.reschedule_origin_dates := (
      SELECT ARRAY(
        SELECT DISTINCT d
        FROM unnest(
          COALESCE(OLD.reschedule_origin_dates, '{}'::date[]) || ((OLD.scheduled_at AT TIME ZONE 'Asia/Seoul')::date)
        ) AS u(d)
        ORDER BY d
      )
    );
  ELSE
    NEW.reschedule_origin_dates := COALESCE(OLD.reschedule_origin_dates, '{}'::date[]);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_class_session_reschedule_origins ON public.class_sessions;

CREATE TRIGGER trg_track_class_session_reschedule_origins
BEFORE UPDATE OF scheduled_at ON public.class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.track_class_session_reschedule_origins();