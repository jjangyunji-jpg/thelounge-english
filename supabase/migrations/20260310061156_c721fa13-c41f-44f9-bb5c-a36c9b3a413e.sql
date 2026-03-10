
-- ============================================
-- Update RLS policies: replace admin checks with is_manager_or_above / is_staff_or_above
-- ============================================

-- user_roles: manager can manage, staff can view all
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Manager can manage roles" ON public.user_roles FOR ALL TO public
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Manager can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Staff or above can view all roles" ON public.user_roles FOR SELECT TO public
  USING (is_staff_or_above(auth.uid()));

-- instructors: manager can manage, staff can view
DROP POLICY IF EXISTS "Admins can delete instructors" ON public.instructors;
CREATE POLICY "Manager can delete instructors" ON public.instructors FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert instructors" ON public.instructors;
CREATE POLICY "Manager can insert instructors" ON public.instructors FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update instructors" ON public.instructors;
CREATE POLICY "Manager can update instructors" ON public.instructors FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));

-- instructor_students: manager can delete
DROP POLICY IF EXISTS "Admin can delete instructor students" ON public.instructor_students;
CREATE POLICY "Manager can delete instructor students" ON public.instructor_students FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

-- student_profiles: manager can manage
DROP POLICY IF EXISTS "Admins can manage student profiles" ON public.student_profiles;
CREATE POLICY "Manager or staff can manage student profiles" ON public.student_profiles FOR ALL TO public
  USING (is_staff_or_above(auth.uid()));

-- cash_receipts: staff+ can read all
DROP POLICY IF EXISTS "Admin can read all receipts" ON public.cash_receipts;
CREATE POLICY "Staff or above can read all receipts" ON public.cash_receipts FOR SELECT TO authenticated
  USING (is_staff_or_above(auth.uid()));

-- class_feedback: manager can update/delete
DROP POLICY IF EXISTS "Admin can delete feedback" ON public.class_feedback;
CREATE POLICY "Manager can delete feedback" ON public.class_feedback FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can update feedback" ON public.class_feedback;
CREATE POLICY "Manager can update feedback" ON public.class_feedback FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()));

-- curriculum_guides: manager can manage, staff can read (already has auth read)
DROP POLICY IF EXISTS "Admin can delete curriculum guides" ON public.curriculum_guides;
CREATE POLICY "Manager can delete curriculum guides" ON public.curriculum_guides FOR DELETE TO authenticated
  USING (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can insert curriculum guides" ON public.curriculum_guides;
CREATE POLICY "Manager can insert curriculum guides" ON public.curriculum_guides FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can update curriculum guides" ON public.curriculum_guides;
CREATE POLICY "Manager can update curriculum guides" ON public.curriculum_guides FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()));

-- feedback_categories: manager can manage
DROP POLICY IF EXISTS "Admin can delete feedback categories" ON public.feedback_categories;
CREATE POLICY "Manager can delete feedback categories" ON public.feedback_categories FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can insert feedback categories" ON public.feedback_categories;
CREATE POLICY "Manager can insert feedback categories" ON public.feedback_categories FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can update feedback categories" ON public.feedback_categories;
CREATE POLICY "Manager can update feedback categories" ON public.feedback_categories FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()));

-- guide_documents: manager can manage, staff can read
DROP POLICY IF EXISTS "Admins can manage guide_documents" ON public.guide_documents;
CREATE POLICY "Manager can manage guide_documents" ON public.guide_documents FOR ALL TO public
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read guide_documents" ON public.guide_documents FOR SELECT TO public
  USING (has_role(auth.uid(), 'staff'::app_role));

-- guide_faqs: manager can manage, staff can read
DROP POLICY IF EXISTS "Admins can manage guide_faqs" ON public.guide_faqs;
CREATE POLICY "Manager can manage guide_faqs" ON public.guide_faqs FOR ALL TO public
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read guide_faqs" ON public.guide_faqs FOR SELECT TO public
  USING (has_role(auth.uid(), 'staff'::app_role));

-- holiday_notices: manager can insert/delete
DROP POLICY IF EXISTS "Admin can delete holidays" ON public.holiday_notices;
CREATE POLICY "Manager can delete holidays" ON public.holiday_notices FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can insert holidays" ON public.holiday_notices;
CREATE POLICY "Manager can insert holidays" ON public.holiday_notices FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()));

-- schedule_periods: manager can manage
DROP POLICY IF EXISTS "Admin can delete schedule periods" ON public.schedule_periods;
CREATE POLICY "Manager can delete schedule periods" ON public.schedule_periods FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can insert schedule periods" ON public.schedule_periods;
CREATE POLICY "Manager can insert schedule periods" ON public.schedule_periods FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admin can update schedule periods" ON public.schedule_periods;
CREATE POLICY "Manager can update schedule periods" ON public.schedule_periods FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()));

-- homework_submissions: manager can delete
DROP POLICY IF EXISTS "Admin can delete submissions" ON public.homework_submissions;
CREATE POLICY "Manager can delete submissions" ON public.homework_submissions FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

-- instructor_student_feedback: manager can delete
DROP POLICY IF EXISTS "Admin can delete instructor student feedback" ON public.instructor_student_feedback;
CREATE POLICY "Manager can delete instructor student feedback" ON public.instructor_student_feedback FOR DELETE TO authenticated
  USING (is_manager_or_above(auth.uid()));

-- vocabulary_test_results: manager can delete
DROP POLICY IF EXISTS "Admin can delete vocab test results" ON public.vocabulary_test_results;
CREATE POLICY "Manager can delete vocab test results" ON public.vocabulary_test_results FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

-- vocabulary_tests: manager can delete
DROP POLICY IF EXISTS "Admin can delete vocab tests" ON public.vocabulary_tests;
CREATE POLICY "Manager can delete vocab tests" ON public.vocabulary_tests FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()));

-- payment_confirmations: manager can manage, staff can read
DROP POLICY IF EXISTS "Admin can manage payment confirmations" ON public.payment_confirmations;
CREATE POLICY "Manager can manage payment confirmations" ON public.payment_confirmations FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read payment confirmations" ON public.payment_confirmations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- prepaid_credits: manager can manage, staff can read
DROP POLICY IF EXISTS "Admin can manage prepaid credits" ON public.prepaid_credits;
CREATE POLICY "Manager can manage prepaid credits" ON public.prepaid_credits FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read prepaid credits" ON public.prepaid_credits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- prepaid_deductions: manager can manage, staff can read
DROP POLICY IF EXISTS "Admin can manage prepaid deductions" ON public.prepaid_deductions;
CREATE POLICY "Manager can manage prepaid deductions" ON public.prepaid_deductions FOR ALL TO authenticated
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read prepaid deductions" ON public.prepaid_deductions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

-- support_requests: staff+ can manage
DROP POLICY IF EXISTS "Admins can manage all requests" ON public.support_requests;
CREATE POLICY "Staff or above can manage all requests" ON public.support_requests FOR ALL TO public
  USING (is_staff_or_above(auth.uid()));

-- teaching_material_categories: manager can manage, staff can read
DROP POLICY IF EXISTS "Admins can manage categories" ON public.teaching_material_categories;
CREATE POLICY "Manager can manage categories" ON public.teaching_material_categories FOR ALL TO public
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read categories" ON public.teaching_material_categories FOR SELECT TO public
  USING (has_role(auth.uid(), 'staff'::app_role));

-- teaching_materials: manager can manage, staff can read
DROP POLICY IF EXISTS "Admins can manage teaching_materials" ON public.teaching_materials;
CREATE POLICY "Manager can manage teaching_materials" ON public.teaching_materials FOR ALL TO public
  USING (is_manager_or_above(auth.uid()))
  WITH CHECK (is_manager_or_above(auth.uid()));
CREATE POLICY "Staff can read teaching_materials" ON public.teaching_materials FOR SELECT TO public
  USING (has_role(auth.uid(), 'staff'::app_role));

-- student_surveys: staff+ can access
DROP POLICY IF EXISTS "Admin full access to surveys" ON public.student_surveys;
CREATE POLICY "Staff or above full access to surveys" ON public.student_surveys FOR ALL TO authenticated
  USING (is_staff_or_above(auth.uid()));

-- Also update policies that use has_role with 'admin' in compound expressions
-- These use OR with instructor, so we need to include manager/staff

-- Update compound policies (instructor OR admin) to use is_manager_or_above
-- business_meeting_attendees
DROP POLICY IF EXISTS "Instructor or admin can delete meeting attendees" ON public.business_meeting_attendees;
CREATE POLICY "Instructor or manager can delete meeting attendees" ON public.business_meeting_attendees FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert meeting attendees" ON public.business_meeting_attendees;
CREATE POLICY "Instructor or manager can insert meeting attendees" ON public.business_meeting_attendees FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update meeting attendees" ON public.business_meeting_attendees;
CREATE POLICY "Instructor or manager can update meeting attendees" ON public.business_meeting_attendees FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- business_meetings
DROP POLICY IF EXISTS "Instructor or admin can delete meetings" ON public.business_meetings;
CREATE POLICY "Instructor or manager can delete meetings" ON public.business_meetings FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert meetings" ON public.business_meetings;
CREATE POLICY "Instructor or manager can insert meetings" ON public.business_meetings FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update meetings" ON public.business_meetings;
CREATE POLICY "Instructor or manager can update meetings" ON public.business_meetings FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- class_session_note_versions
DROP POLICY IF EXISTS "Instructor or admin can delete note versions" ON public.class_session_note_versions;
CREATE POLICY "Instructor or manager can delete note versions" ON public.class_session_note_versions FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert note versions" ON public.class_session_note_versions;
CREATE POLICY "Instructor or manager can insert note versions" ON public.class_session_note_versions FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update note versions" ON public.class_session_note_versions;
CREATE POLICY "Instructor or manager can update note versions" ON public.class_session_note_versions FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- class_sessions
DROP POLICY IF EXISTS "Instructor or admin can delete sessions" ON public.class_sessions;
CREATE POLICY "Instructor or manager can delete sessions" ON public.class_sessions FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert sessions" ON public.class_sessions;
CREATE POLICY "Instructor or manager can insert sessions" ON public.class_sessions FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update sessions" ON public.class_sessions;
CREATE POLICY "Instructor or manager can update sessions" ON public.class_sessions FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- homework_assignments
DROP POLICY IF EXISTS "Instructor or admin can delete assignments" ON public.homework_assignments;
CREATE POLICY "Instructor or manager can delete assignments" ON public.homework_assignments FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert assignments" ON public.homework_assignments;
CREATE POLICY "Instructor or manager can insert assignments" ON public.homework_assignments FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update assignments" ON public.homework_assignments;
CREATE POLICY "Instructor or manager can update assignments" ON public.homework_assignments FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- homework_submissions
DROP POLICY IF EXISTS "Instructor or admin can update submissions" ON public.homework_submissions;
CREATE POLICY "Instructor or manager can update submissions" ON public.homework_submissions FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- instructor_available_slots
DROP POLICY IF EXISTS "Instructor or admin can delete slots" ON public.instructor_available_slots;
CREATE POLICY "Instructor or manager can delete slots" ON public.instructor_available_slots FOR DELETE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert slots" ON public.instructor_available_slots;
CREATE POLICY "Instructor or manager can insert slots" ON public.instructor_available_slots FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update slots" ON public.instructor_available_slots;
CREATE POLICY "Instructor or manager can update slots" ON public.instructor_available_slots FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- instructor_student_feedback
DROP POLICY IF EXISTS "Instructor or admin can insert instructor student feedback" ON public.instructor_student_feedback;
CREATE POLICY "Instructor or manager can insert instructor student feedback" ON public.instructor_student_feedback FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update instructor student feedback" ON public.instructor_student_feedback;
CREATE POLICY "Instructor or manager can update instructor student feedback" ON public.instructor_student_feedback FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- instructor_students
DROP POLICY IF EXISTS "Admin or instructor can insert instructor students" ON public.instructor_students;
CREATE POLICY "Manager or instructor can insert instructor students" ON public.instructor_students FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Admin or instructor can update instructor students" ON public.instructor_students;
CREATE POLICY "Manager or instructor can update instructor students" ON public.instructor_students FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- makeup_requests
DROP POLICY IF EXISTS "Instructor or admin can update makeup requests" ON public.makeup_requests;
CREATE POLICY "Instructor or manager can update makeup requests" ON public.makeup_requests FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- student_pauses
DROP POLICY IF EXISTS "Instructor or admin can delete student pauses" ON public.student_pauses;
CREATE POLICY "Instructor or manager can delete student pauses" ON public.student_pauses FOR DELETE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can insert student pauses" ON public.student_pauses;
CREATE POLICY "Instructor or manager can insert student pauses" ON public.student_pauses FOR INSERT TO public
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update student pauses" ON public.student_pauses;
CREATE POLICY "Instructor or manager can update student pauses" ON public.student_pauses FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- student_reports
DROP POLICY IF EXISTS "Instructor or admin can insert student reports" ON public.student_reports;
CREATE POLICY "Instructor or manager can insert student reports" ON public.student_reports FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

DROP POLICY IF EXISTS "Instructor or admin can update student reports" ON public.student_reports;
CREATE POLICY "Instructor or manager can update student reports" ON public.student_reports FOR UPDATE TO authenticated
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));

-- vocab_test_results compound
DROP POLICY IF EXISTS "Admin or instructor can update vocab test results" ON public.vocabulary_test_results;
CREATE POLICY "Manager or instructor can update vocab test results" ON public.vocabulary_test_results FOR UPDATE TO public
  USING (is_manager_or_above(auth.uid()) OR has_role(auth.uid(), 'instructor'::app_role));
