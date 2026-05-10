export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_by: string[]
          scheduled_at: string | null
          sent_at: string | null
          subject: string
          target: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_by?: string[]
          scheduled_at?: string | null
          sent_at?: string | null
          subject: string
          target?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_by?: string[]
          scheduled_at?: string | null
          sent_at?: string | null
          subject?: string
          target?: string
        }
        Relationships: []
      }
      ai_program_payments: {
        Row: {
          amount_override: number | null
          created_at: string
          id: string
          month: string
          note: string | null
          paid: boolean
          payment_method: string
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          amount_override?: number | null
          created_at?: string
          id?: string
          month: string
          note?: string | null
          paid?: boolean
          payment_method?: string
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          amount_override?: number | null
          created_at?: string
          id?: string
          month?: string
          note?: string | null
          paid?: boolean
          payment_method?: string
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_program_payments_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "ai_program_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_program_subscribers: {
        Row: {
          created_at: string
          customer_name: string
          end_month: string | null
          id: string
          note: string | null
          program_type: string
          start_month: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          end_month?: string | null
          id?: string
          note?: string | null
          program_type: string
          start_month: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          end_month?: string | null
          id?: string
          note?: string | null
          program_type?: string
          start_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          student_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          student_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          student_name?: string
        }
        Relationships: []
      }
      billable_overrides: {
        Row: {
          billable_count: number
          created_at: string
          id: string
          note: string | null
          period_end: string
          period_start: string
          student_name: string
          updated_at: string
        }
        Insert: {
          billable_count: number
          created_at?: string
          id?: string
          note?: string | null
          period_end: string
          period_start: string
          student_name: string
          updated_at?: string
        }
        Update: {
          billable_count?: number
          created_at?: string
          id?: string
          note?: string | null
          period_end?: string
          period_start?: string
          student_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_meeting_attendees: {
        Row: {
          created_at: string
          id: string
          instructor_id: string
          meeting_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_id: string
          meeting_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_meeting_attendees_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_meeting_attendees_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "business_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      business_meetings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          instructor_id: string
          meet_link: string | null
          notes: string | null
          scheduled_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          instructor_id: string
          meet_link?: string | null
          notes?: string | null
          scheduled_at: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          instructor_id?: string
          meet_link?: string | null
          notes?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_meetings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_meetings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_receipts: {
        Row: {
          created_at: string
          id: string
          receipt_number: string
          receipt_type: string
          recurring: boolean
          recurring_attendance: boolean
          student_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receipt_number?: string
          receipt_type?: string
          recurring?: boolean
          recurring_attendance?: boolean
          student_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receipt_number?: string
          receipt_type?: string
          recurring?: boolean
          recurring_attendance?: boolean
          student_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_feedback: {
        Row: {
          comment: string | null
          communication: number
          created_at: string
          id: string
          instructor_name: string
          lesson_preparation: number
          period_id: string | null
          period_label: string
          ratings: Json | null
          satisfaction: number
          student_name: string
          teaching_quality: number
        }
        Insert: {
          comment?: string | null
          communication: number
          created_at?: string
          id?: string
          instructor_name: string
          lesson_preparation: number
          period_id?: string | null
          period_label: string
          ratings?: Json | null
          satisfaction: number
          student_name: string
          teaching_quality: number
        }
        Update: {
          comment?: string | null
          communication?: number
          created_at?: string
          id?: string
          instructor_name?: string
          lesson_preparation?: number
          period_id?: string | null
          period_label?: string
          ratings?: Json | null
          satisfaction?: number
          student_name?: string
          teaching_quality?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_feedback_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "schedule_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      class_session_note_versions: {
        Row: {
          id: string
          notes: string | null
          saved_at: string
          session_id: string
          topic: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          saved_at?: string
          session_id: string
          topic?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          saved_at?: string
          session_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_session_note_versions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          cancellation_resolution: string | null
          cancellation_type: string | null
          carryover_direction: string | null
          carryover_reason: string | null
          created_at: string
          ended_at: string | null
          gcal_event_id: string | null
          group_students: string[]
          id: string
          instructor_name: string
          is_carryover: boolean
          level: string
          meet_link: string | null
          notes: string | null
          remarks: string | null
          reschedule_origin_dates: string[]
          scheduled_at: string
          started_at: string | null
          student_name: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          cancellation_resolution?: string | null
          cancellation_type?: string | null
          carryover_direction?: string | null
          carryover_reason?: string | null
          created_at?: string
          ended_at?: string | null
          gcal_event_id?: string | null
          group_students?: string[]
          id?: string
          instructor_name: string
          is_carryover?: boolean
          level?: string
          meet_link?: string | null
          notes?: string | null
          remarks?: string | null
          reschedule_origin_dates?: string[]
          scheduled_at: string
          started_at?: string | null
          student_name: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_resolution?: string | null
          cancellation_type?: string | null
          carryover_direction?: string | null
          carryover_reason?: string | null
          created_at?: string
          ended_at?: string | null
          gcal_event_id?: string | null
          group_students?: string[]
          id?: string
          instructor_name?: string
          is_carryover?: boolean
          level?: string
          meet_link?: string | null
          notes?: string | null
          remarks?: string | null
          reschedule_origin_dates?: string[]
          scheduled_at?: string
          started_at?: string | null
          student_name?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_guides: {
        Row: {
          content: string
          created_at: string
          id: string
          level: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          level: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          level?: string
          updated_at?: string
        }
        Relationships: []
      }
      deleted_session_dates: {
        Row: {
          created_at: string
          deleted_by: string | null
          deleted_date: string
          id: string
          student_name: string
        }
        Insert: {
          created_at?: string
          deleted_by?: string | null
          deleted_date: string
          id?: string
          student_name: string
        }
        Update: {
          created_at?: string
          deleted_by?: string | null
          deleted_date?: string
          id?: string
          student_name?: string
        }
        Relationships: []
      }
      feedback_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      guide_documents: {
        Row: {
          category: string
          created_at: string
          file_url: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_url: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          file_url?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      guide_faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
        }
        Relationships: []
      }
      holiday_notices: {
        Row: {
          created_at: string
          date_end: string
          date_start: string
          dismissed_by: string[] | null
          id: string
          notified_15d: boolean
          notified_7d: boolean
          notify_students: boolean
          reason: string | null
          title: string
        }
        Insert: {
          created_at?: string
          date_end: string
          date_start: string
          dismissed_by?: string[] | null
          id?: string
          notified_15d?: boolean
          notified_7d?: boolean
          notify_students?: boolean
          reason?: string | null
          title: string
        }
        Update: {
          created_at?: string
          date_end?: string
          date_start?: string
          dismissed_by?: string[] | null
          id?: string
          notified_15d?: boolean
          notified_7d?: boolean
          notify_students?: boolean
          reason?: string | null
          title?: string
        }
        Relationships: []
      }
      homework_assignments: {
        Row: {
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          is_preset: boolean
          preset_origin_id: string | null
          session_id: string | null
          student_name: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_preset?: boolean
          preset_origin_id?: string | null
          session_id?: string | null
          student_name: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_preset?: boolean
          preset_origin_id?: string | null
          session_id?: string | null
          student_name?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_preset_origin_id_fkey"
            columns: ["preset_origin_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          ai_correction: Json | null
          assignment_id: string | null
          audio_url: string | null
          file_url: string | null
          id: string
          instructor_note: string | null
          reviewed_at: string | null
          status: string
          student_name: string
          submitted_at: string
          text_content: string | null
        }
        Insert: {
          ai_correction?: Json | null
          assignment_id?: string | null
          audio_url?: string | null
          file_url?: string | null
          id?: string
          instructor_note?: string | null
          reviewed_at?: string | null
          status?: string
          student_name: string
          submitted_at?: string
          text_content?: string | null
        }
        Update: {
          ai_correction?: Json | null
          assignment_id?: string | null
          audio_url?: string | null
          file_url?: string | null
          id?: string
          instructor_note?: string | null
          reviewed_at?: string | null
          status?: string
          student_name?: string
          submitted_at?: string
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_available_slots: {
        Row: {
          created_at: string
          id: string
          instructor_id: string
          instructor_name: string
          slot_date: string
          slot_time: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_id: string
          instructor_name: string
          slot_date: string
          slot_time: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_id?: string
          instructor_name?: string
          slot_date?: string
          slot_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_available_slots_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_available_slots_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_calendar_mapping: {
        Row: {
          created_at: string
          display_name: string | null
          gcal_calendar_id: string
          id: string
          instructor_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          gcal_calendar_id: string
          id?: string
          instructor_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          gcal_calendar_id?: string
          id?: string
          instructor_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructor_student_feedback: {
        Row: {
          applied_goals: boolean
          checklist: Json
          comment: string | null
          created_at: string
          id: string
          instructor_name: string
          period_id: string | null
          period_label: string
          student_name: string
          suggested_goals: string | null
        }
        Insert: {
          applied_goals?: boolean
          checklist?: Json
          comment?: string | null
          created_at?: string
          id?: string
          instructor_name: string
          period_id?: string | null
          period_label: string
          student_name: string
          suggested_goals?: string | null
        }
        Update: {
          applied_goals?: boolean
          checklist?: Json
          comment?: string | null
          created_at?: string
          id?: string
          instructor_name?: string
          period_id?: string | null
          period_label?: string
          student_name?: string
          suggested_goals?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_student_feedback_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "schedule_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_students: {
        Row: {
          cash_payment: boolean
          corporate_rate: number | null
          created_at: string
          end_date: string | null
          english_name: string | null
          extra_lessons: number | null
          google_sheet_url: string | null
          group_students: string[]
          id: string
          instructor_id: string | null
          instructor_name: string | null
          learning_objective: string | null
          lesson_goal: string | null
          level: string | null
          meet_link: string | null
          pause_end: string | null
          pause_start: string | null
          phone: string | null
          reminder_enabled: boolean | null
          schedules: string | null
          start_date: string | null
          status: string | null
          student_name: string
          student_type: string
          tax_invoice: boolean
          transfer_date: string | null
          transfer_from_id: string | null
          transfer_status: string | null
          user_id: string | null
          withdrawal_reason: string | null
        }
        Insert: {
          cash_payment?: boolean
          corporate_rate?: number | null
          created_at?: string
          end_date?: string | null
          english_name?: string | null
          extra_lessons?: number | null
          google_sheet_url?: string | null
          group_students?: string[]
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          learning_objective?: string | null
          lesson_goal?: string | null
          level?: string | null
          meet_link?: string | null
          pause_end?: string | null
          pause_start?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          schedules?: string | null
          start_date?: string | null
          status?: string | null
          student_name: string
          student_type?: string
          tax_invoice?: boolean
          transfer_date?: string | null
          transfer_from_id?: string | null
          transfer_status?: string | null
          user_id?: string | null
          withdrawal_reason?: string | null
        }
        Update: {
          cash_payment?: boolean
          corporate_rate?: number | null
          created_at?: string
          end_date?: string | null
          english_name?: string | null
          extra_lessons?: number | null
          google_sheet_url?: string | null
          group_students?: string[]
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          learning_objective?: string | null
          lesson_goal?: string | null
          level?: string | null
          meet_link?: string | null
          pause_end?: string | null
          pause_start?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          schedules?: string | null
          start_date?: string | null
          status?: string | null
          student_name?: string
          student_type?: string
          tax_invoice?: boolean
          transfer_date?: string | null
          transfer_from_id?: string | null
          transfer_status?: string | null
          user_id?: string | null
          withdrawal_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_students_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_students_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_students_transfer_from_id_fkey"
            columns: ["transfer_from_id"]
            isOneToOne: false
            referencedRelation: "instructor_students"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          active: boolean
          age: number | null
          bio_notes: string | null
          created_at: string
          deactivation_reason: string | null
          education: string | null
          email: string | null
          english_name: string | null
          gender: string | null
          id: string
          join_date: string | null
          lesson_rate: number
          meet_link: string | null
          meeting_rate: number
          name: string
          phone: string | null
          position: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          age?: number | null
          bio_notes?: string | null
          created_at?: string
          deactivation_reason?: string | null
          education?: string | null
          email?: string | null
          english_name?: string | null
          gender?: string | null
          id?: string
          join_date?: string | null
          lesson_rate?: number
          meet_link?: string | null
          meeting_rate?: number
          name: string
          phone?: string | null
          position?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          age?: number | null
          bio_notes?: string | null
          created_at?: string
          deactivation_reason?: string | null
          education?: string | null
          email?: string | null
          english_name?: string | null
          gender?: string | null
          id?: string
          join_date?: string | null
          lesson_rate?: number
          meet_link?: string | null
          meeting_rate?: number
          name?: string
          phone?: string | null
          position?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      key_expression_test_results: {
        Row: {
          ai_feedback: string | null
          created_at: string
          expression_id: string
          id: string
          is_correct: boolean
          score: number
          student_answer: string
          student_name: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          expression_id: string
          id?: string
          is_correct?: boolean
          score?: number
          student_answer: string
          student_name: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          expression_id?: string
          id?: string
          is_correct?: boolean
          score?: number
          student_answer?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_expression_test_results_expression_id_fkey"
            columns: ["expression_id"]
            isOneToOne: false
            referencedRelation: "key_expressions"
            referencedColumns: ["id"]
          },
        ]
      }
      key_expressions: {
        Row: {
          created_at: string
          created_by_instructor: string | null
          english: string
          id: string
          korean: string
          session_id: string | null
          situation_label: string
          student_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_instructor?: string | null
          english: string
          id?: string
          korean: string
          session_id?: string | null
          situation_label?: string
          student_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_instructor?: string | null
          english?: string
          id?: string
          korean?: string
          session_id?: string | null
          situation_label?: string
          student_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      makeup_requests: {
        Row: {
          created_at: string
          group_students: string[]
          id: string
          instructor_name: string
          original_scheduled_at: string | null
          original_session_id: string | null
          reject_reason: string | null
          rejection_code: string | null
          request_type: string
          resolved_at: string | null
          slot_id: string | null
          status: string
          student_name: string
          urgent_reason: string | null
        }
        Insert: {
          created_at?: string
          group_students?: string[]
          id?: string
          instructor_name: string
          original_scheduled_at?: string | null
          original_session_id?: string | null
          reject_reason?: string | null
          rejection_code?: string | null
          request_type?: string
          resolved_at?: string | null
          slot_id?: string | null
          status?: string
          student_name: string
          urgent_reason?: string | null
        }
        Update: {
          created_at?: string
          group_students?: string[]
          id?: string
          instructor_name?: string
          original_scheduled_at?: string | null
          original_session_id?: string | null
          reject_reason?: string | null
          rejection_code?: string | null
          request_type?: string
          resolved_at?: string | null
          slot_id?: string | null
          status?: string
          student_name?: string
          urgent_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "makeup_requests_original_session_id_fkey"
            columns: ["original_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_requests_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "instructor_available_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_confirmations: {
        Row: {
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          id: string
          month: string
          note: string | null
          student_name: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          month: string
          note?: string | null
          student_name: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          month?: string
          note?: string | null
          student_name?: string
        }
        Relationships: []
      }
      prepaid_credits: {
        Row: {
          created_at: string
          id: string
          note: string | null
          student_name: string
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          student_name: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          student_name?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: []
      }
      prepaid_deductions: {
        Row: {
          created_at: string
          deducted_sessions: number
          id: string
          month: string
          student_name: string
        }
        Insert: {
          created_at?: string
          deducted_sessions?: number
          id?: string
          month: string
          student_name: string
        }
        Update: {
          created_at?: string
          deducted_sessions?: number
          id?: string
          month?: string
          student_name?: string
        }
        Relationships: []
      }
      renewal_confirmations: {
        Row: {
          created_at: string
          decided_at: string
          decided_by_user_id: string | null
          decided_via: string
          decision: string
          id: string
          period_id: string
          processed_at: string | null
          student_name: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by_user_id?: string | null
          decided_via?: string
          decision: string
          id?: string
          period_id: string
          processed_at?: string | null
          student_name: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by_user_id?: string | null
          decided_via?: string
          decision?: string
          id?: string
          period_id?: string
          processed_at?: string | null
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_confirmations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "schedule_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          label: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          label: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          label?: string
          start_date?: string
        }
        Relationships: []
      }
      store_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: string
          note: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          month: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_pauses: {
        Row: {
          created_at: string
          id: string
          pause_end: string | null
          pause_start: string
          reason: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pause_end?: string | null
          pause_start: string
          reason?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pause_end?: string | null
          pause_start?: string
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_pauses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "instructor_students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string | null
          student_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nickname?: string | null
          student_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string | null
          student_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          instructor_name: string
          is_read: boolean
          period_id: string | null
          period_label: string
          student_name: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          instructor_name: string
          is_read?: boolean
          period_id?: string | null
          period_label: string
          student_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          instructor_name?: string
          is_read?: boolean
          period_id?: string | null
          period_label?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_reports_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "schedule_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      student_surveys: {
        Row: {
          additional_note: string | null
          completed_at: string | null
          created_at: string
          disliked_methods: string | null
          english_usage_frequency: string | null
          id: string
          interest_topics: string[] | null
          past_methods: string | null
          preferred_methods: string[] | null
          student_name: string
          study_goal: string | null
          study_reason: string[] | null
          study_trigger: string | null
          user_id: string
        }
        Insert: {
          additional_note?: string | null
          completed_at?: string | null
          created_at?: string
          disliked_methods?: string | null
          english_usage_frequency?: string | null
          id?: string
          interest_topics?: string[] | null
          past_methods?: string | null
          preferred_methods?: string[] | null
          student_name: string
          study_goal?: string | null
          study_reason?: string[] | null
          study_trigger?: string | null
          user_id: string
        }
        Update: {
          additional_note?: string | null
          completed_at?: string | null
          created_at?: string
          disliked_methods?: string | null
          english_usage_frequency?: string | null
          id?: string
          interest_topics?: string[] | null
          past_methods?: string | null
          preferred_methods?: string[] | null
          student_name?: string
          study_goal?: string | null
          study_reason?: string[] | null
          study_trigger?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          admin_note: string | null
          category: string
          created_at: string
          description: string
          id: string
          resolved_at: string | null
          role: string
          status: string
          title: string
          user_id: string
          user_name: string
        }
        Insert: {
          admin_note?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          resolved_at?: string | null
          role: string
          status?: string
          title: string
          user_id: string
          user_name: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          resolved_at?: string | null
          role?: string
          status?: string
          title?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      teaching_category_instructors: {
        Row: {
          category: string
          created_at: string
          id: string
          instructor_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          instructor_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          instructor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_category_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructor_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_category_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_material_categories: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          level: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          level?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          level?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      teaching_materials: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          approved: boolean
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          approved?: boolean
          display_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          approved?: boolean
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vocabulary_test_results: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean | null
          student_answer: string | null
          test_id: string | null
          word_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean | null
          student_answer?: string | null
          test_id?: string | null
          word_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean | null
          student_answer?: string | null
          test_id?: string | null
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_test_results_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_words"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_tests: {
        Row: {
          completed_at: string | null
          id: string
          score: number | null
          started_at: string
          student_name: string
          total: number | null
          type: string
          week_label: string | null
          word_ids: string[] | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          student_name: string
          total?: number | null
          type: string
          week_label?: string | null
          word_ids?: string[] | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          student_name?: string
          total?: number | null
          type?: string
          week_label?: string | null
          word_ids?: string[] | null
        }
        Relationships: []
      }
      vocabulary_words: {
        Row: {
          audio_url: string | null
          created_at: string
          english_word: string
          example_sentence: string | null
          id: string
          korean_meaning: string
          part_of_speech: string | null
          session_id: string | null
          student_name: string
          week_label: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          english_word: string
          example_sentence?: string | null
          id?: string
          korean_meaning: string
          part_of_speech?: string | null
          session_id?: string | null
          student_name: string
          week_label: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          english_word?: string
          example_sentence?: string | null
          id?: string
          korean_meaning?: string
          part_of_speech?: string | null
          session_id?: string | null
          student_name?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_words_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          created_at: string
          desired_level: string | null
          id: string
          note: string | null
          phone: string | null
          preferred_schedule: string | null
          queue_number: number
          status: string
          student_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desired_level?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          preferred_schedule?: string | null
          queue_number?: number
          status?: string
          student_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          desired_level?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          preferred_schedule?: string | null
          queue_number?: number
          status?: string
          student_name?: string
          user_id?: string
        }
        Relationships: []
      }
      word_lookup_cache: {
        Row: {
          created_at: string
          id: string
          level: string
          result: Json
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          result: Json
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          result?: Json
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      instructor_directory: {
        Row: {
          active: boolean | null
          id: string | null
          meet_link: string | null
          name: string | null
          position: string | null
        }
        Insert: {
          active?: boolean | null
          id?: string | null
          meet_link?: string | null
          name?: string | null
          position?: string | null
        }
        Update: {
          active?: boolean | null
          id?: string | null
          meet_link?: string | null
          name?: string | null
          position?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
      is_staff_or_above: { Args: { _user_id: string }; Returns: boolean }
      student_cancel_class_session: {
        Args: { _session_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "instructor" | "student" | "manager" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "instructor", "student", "manager", "staff"],
    },
  },
} as const
