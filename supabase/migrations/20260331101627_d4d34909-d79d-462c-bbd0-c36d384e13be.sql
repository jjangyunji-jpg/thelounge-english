-- Remove duplicate class_sessions, keeping only the oldest per (student_name, scheduled_at)
DELETE FROM class_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (student_name, scheduled_at) id
  FROM class_sessions
  ORDER BY student_name, scheduled_at, created_at ASC
);

-- Add unique index to prevent future duplicates
CREATE UNIQUE INDEX uq_class_sessions_student_scheduled
ON class_sessions (student_name, scheduled_at);