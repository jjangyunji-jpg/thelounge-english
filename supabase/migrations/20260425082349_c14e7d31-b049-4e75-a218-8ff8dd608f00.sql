UPDATE class_sessions
SET ended_at = scheduled_at + interval '1 hour'
WHERE student_name IN ('유은실','채화정')
  AND scheduled_at >= '2026-04-13T00:00:00+09:00'
  AND scheduled_at <= '2026-04-13T23:59:59+09:00'
  AND ended_at IS NULL
  AND notes IS NOT NULL
  AND notes <> ''
  AND cancellation_type IS NULL;