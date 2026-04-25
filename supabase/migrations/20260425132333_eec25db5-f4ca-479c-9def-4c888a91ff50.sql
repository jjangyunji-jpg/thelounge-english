DELETE FROM homework_assignments ha
USING class_sessions cs
WHERE ha.session_id = cs.id
  AND ha.preset_origin_id IS NOT NULL
  AND ha.created_at > cs.scheduled_at
  AND NOT EXISTS (
    SELECT 1 FROM homework_submissions hs WHERE hs.assignment_id = ha.id
  );