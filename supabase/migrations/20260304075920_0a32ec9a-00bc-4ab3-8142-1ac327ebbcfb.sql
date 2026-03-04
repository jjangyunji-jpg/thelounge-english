
-- =============================================
-- Fix RLS: Replace permissive USING(true) with role-based policies
-- =============================================

-- business_meeting_attendees
DROP POLICY IF EXISTS "Allow all business_meeting_attendees" ON public.business_meeting_attendees;
CREATE POLICY "Authenticated can read meeting attendees" ON public.business_meeting_attendees FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert meeting attendees" ON public.business_meeting_attendees FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update meeting attendees" ON public.business_meeting_attendees FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete meeting attendees" ON public.business_meeting_attendees FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- business_meetings
DROP POLICY IF EXISTS "Allow all business_meetings" ON public.business_meetings;
CREATE POLICY "Authenticated can read meetings" ON public.business_meetings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert meetings" ON public.business_meetings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update meetings" ON public.business_meetings FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete meetings" ON public.business_meetings FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- class_feedback
DROP POLICY IF EXISTS "Allow all class_feedback" ON public.class_feedback;
CREATE POLICY "Authenticated can read feedback" ON public.class_feedback FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert feedback" ON public.class_feedback FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can update feedback" ON public.class_feedback FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete feedback" ON public.class_feedback FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- class_session_note_versions
DROP POLICY IF EXISTS "Allow all note_versions" ON public.class_session_note_versions;
CREATE POLICY "Authenticated can read note versions" ON public.class_session_note_versions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert note versions" ON public.class_session_note_versions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update note versions" ON public.class_session_note_versions FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete note versions" ON public.class_session_note_versions FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- class_sessions
DROP POLICY IF EXISTS "Allow all class_sessions" ON public.class_sessions;
CREATE POLICY "Authenticated can read sessions" ON public.class_sessions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert sessions" ON public.class_sessions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update sessions" ON public.class_sessions FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete sessions" ON public.class_sessions FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- feedback_categories
DROP POLICY IF EXISTS "Allow all feedback_categories" ON public.feedback_categories;
CREATE POLICY "Authenticated can read feedback categories" ON public.feedback_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert feedback categories" ON public.feedback_categories FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update feedback categories" ON public.feedback_categories FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete feedback categories" ON public.feedback_categories FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- holiday_notices
DROP POLICY IF EXISTS "Allow all holiday_notices" ON public.holiday_notices;
CREATE POLICY "Authenticated can read holidays" ON public.holiday_notices FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update holiday dismissals" ON public.holiday_notices FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert holidays" ON public.holiday_notices FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete holidays" ON public.holiday_notices FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- homework_assignments
DROP POLICY IF EXISTS "Allow all homework_assignments" ON public.homework_assignments;
CREATE POLICY "Authenticated can read assignments" ON public.homework_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert assignments" ON public.homework_assignments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update assignments" ON public.homework_assignments FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete assignments" ON public.homework_assignments FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- homework_submissions
DROP POLICY IF EXISTS "Allow all homework_submissions" ON public.homework_submissions;
CREATE POLICY "Authenticated can read submissions" ON public.homework_submissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert submissions" ON public.homework_submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can update submissions" ON public.homework_submissions FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Admin can delete submissions" ON public.homework_submissions FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- instructor_students
DROP POLICY IF EXISTS "Allow insert instructor_students" ON public.instructor_students;
DROP POLICY IF EXISTS "Allow read instructor_students" ON public.instructor_students;
CREATE POLICY "Authenticated can read instructor students" ON public.instructor_students FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin or instructor can insert instructor students" ON public.instructor_students FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Admin or instructor can update instructor students" ON public.instructor_students FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Admin can delete instructor students" ON public.instructor_students FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- schedule_periods
DROP POLICY IF EXISTS "Allow all schedule_periods" ON public.schedule_periods;
CREATE POLICY "Authenticated can read schedule periods" ON public.schedule_periods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can insert schedule periods" ON public.schedule_periods FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update schedule periods" ON public.schedule_periods FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete schedule periods" ON public.schedule_periods FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- student_pauses
DROP POLICY IF EXISTS "Allow all student_pauses" ON public.student_pauses;
CREATE POLICY "Authenticated can read student pauses" ON public.student_pauses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert student pauses" ON public.student_pauses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update student pauses" ON public.student_pauses FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete student pauses" ON public.student_pauses FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- vocabulary_test_results
DROP POLICY IF EXISTS "Allow all vocabulary_test_results" ON public.vocabulary_test_results;
CREATE POLICY "Authenticated can read vocab test results" ON public.vocabulary_test_results FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert vocab test results" ON public.vocabulary_test_results FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin or instructor can update vocab test results" ON public.vocabulary_test_results FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Admin can delete vocab test results" ON public.vocabulary_test_results FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- vocabulary_tests
DROP POLICY IF EXISTS "Allow all vocabulary_tests" ON public.vocabulary_tests;
CREATE POLICY "Authenticated can read vocab tests" ON public.vocabulary_tests FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert vocab tests" ON public.vocabulary_tests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update vocab tests" ON public.vocabulary_tests FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can delete vocab tests" ON public.vocabulary_tests FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- vocabulary_words
DROP POLICY IF EXISTS "Allow all vocabulary_words" ON public.vocabulary_words;
CREATE POLICY "Authenticated can read vocab words" ON public.vocabulary_words FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Instructor or admin can insert vocab words" ON public.vocabulary_words FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can update vocab words" ON public.vocabulary_words FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Instructor or admin can delete vocab words" ON public.vocabulary_words FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- =============================================
-- Harden SECURITY DEFINER: set search_path to empty
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- Storage: require auth for uploads (prevent anonymous uploads)
-- =============================================
DROP POLICY IF EXISTS "Public insert homework-audio" ON storage.objects;
CREATE POLICY "Authenticated can upload homework audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'homework-audio' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Public insert vocab-audio" ON storage.objects;
CREATE POLICY "Authenticated can upload vocab audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vocab-audio' AND auth.uid() IS NOT NULL);
