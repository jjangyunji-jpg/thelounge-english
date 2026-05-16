-- 1) Detach makeup_requests FKs first (constraint blocks delete)
UPDATE public.makeup_requests SET original_session_id = NULL
WHERE original_session_id IN (
  '99ed43b3-e331-4414-9a07-bbaf7b952dd6',
  'fccd2ada-37a0-42be-96ca-0027d89c7094',
  'e3b8bcd0-62c1-4ef8-9e83-d7739d93bfa1',
  '334a7aa0-5016-4ff6-9d84-69860b91b657',
  '8c239858-90b5-4fe6-8e07-7ce0b405604a',
  'b7fc3543-d4ba-47c6-b850-27a8c9109371',
  'f193c1ac-7ad9-469b-9235-b50f0b5e5e70',
  '4aa0d643-1ee4-475f-989c-a275185fb1b5',
  '604001c0-8dc6-4f60-9ed7-d6cd27e12c24',
  'bcef67f3-63c0-4ea9-81d3-cacb8ab23f1c',
  'bf7fc1c5-e113-438c-bed0-22ec61484944',
  '72598166-8a85-495e-9e4c-4e4a1b52f33a'
);

-- 2) Delete ghost duplicate original sessions
-- (homework_assignments cascade on session_id; deleted_session_dates trigger fires)
DELETE FROM public.class_sessions
WHERE id IN (
  '99ed43b3-e331-4414-9a07-bbaf7b952dd6',
  'fccd2ada-37a0-42be-96ca-0027d89c7094',
  'e3b8bcd0-62c1-4ef8-9e83-d7739d93bfa1',
  '334a7aa0-5016-4ff6-9d84-69860b91b657',
  '8c239858-90b5-4fe6-8e07-7ce0b405604a',
  'b7fc3543-d4ba-47c6-b850-27a8c9109371',
  'f193c1ac-7ad9-469b-9235-b50f0b5e5e70',
  '4aa0d643-1ee4-475f-989c-a275185fb1b5',
  '604001c0-8dc6-4f60-9ed7-d6cd27e12c24',
  'bcef67f3-63c0-4ea9-81d3-cacb8ab23f1c',
  'bf7fc1c5-e113-438c-bed0-22ec61484944',
  '72598166-8a85-495e-9e4c-4e4a1b52f33a'
);