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
      business_meetings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          instructor_id: string
          notes: string | null
          scheduled_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          instructor_id: string
          notes?: string | null
          scheduled_at: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          instructor_id?: string
          notes?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_meetings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          instructor_name: string
          level: string
          meet_link: string | null
          notes: string | null
          scheduled_at: string
          started_at: string | null
          student_name: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          instructor_name: string
          level?: string
          meet_link?: string | null
          notes?: string | null
          scheduled_at: string
          started_at?: string | null
          student_name: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          instructor_name?: string
          level?: string
          meet_link?: string | null
          notes?: string | null
          scheduled_at?: string
          started_at?: string | null
          student_name?: string
          topic?: string | null
          updated_at?: string
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
          session_id?: string | null
          student_name?: string
          title?: string
          type?: string
        }
        Relationships: [
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
          assignment_id: string | null
          audio_url: string | null
          id: string
          instructor_note: string | null
          reviewed_at: string | null
          status: string
          student_name: string
          submitted_at: string
          text_content: string | null
        }
        Insert: {
          assignment_id?: string | null
          audio_url?: string | null
          id?: string
          instructor_note?: string | null
          reviewed_at?: string | null
          status?: string
          student_name: string
          submitted_at?: string
          text_content?: string | null
        }
        Update: {
          assignment_id?: string | null
          audio_url?: string | null
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
      instructor_students: {
        Row: {
          created_at: string
          id: string
          instructor_id: string
          student_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_id: string
          student_name: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_students_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          lesson_rate: number
          meeting_rate: number
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          lesson_rate?: number
          meeting_rate?: number
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          lesson_rate?: number
          meeting_rate?: number
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "instructor"
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
      app_role: ["admin", "instructor"],
    },
  },
} as const
