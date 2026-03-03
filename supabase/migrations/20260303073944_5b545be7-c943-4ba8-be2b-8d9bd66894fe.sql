ALTER TABLE class_sessions DISABLE TRIGGER prevent_delete_session_with_data;

DELETE FROM class_sessions 
WHERE student_name = '최동근' 
AND scheduled_at >= '2026-03-04T00:00:00+09:00'
AND started_at IS NULL 
AND (notes IS NULL OR notes = '')
AND extract(dow from (scheduled_at AT TIME ZONE 'Asia/Seoul')) = 4;

ALTER TABLE class_sessions ENABLE TRIGGER prevent_delete_session_with_data;