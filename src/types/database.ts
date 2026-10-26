export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          is_active: boolean;
          name: string;
          school_id: string;
          start_date: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          is_active?: boolean;
          name: string;
          school_id: string;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          school_id?: string;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          id: string;
          marked_at: string;
          marked_by: string;
          section_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          marked_at?: string;
          marked_by: string;
          section_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          marked_at?: string;
          marked_by?: string;
          section_id?: string;
          session_id?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_marked_by_fkey";
            columns: ["marked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_session_id_section_id_fkey";
            columns: ["session_id", "section_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id", "section_id"];
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_sessions: {
        Row: {
          attendance_date: string;
          created_at: string;
          created_by: string;
          id: string;
          locked_at: string | null;
          school_id: string;
          section_id: string;
          status: Database["public"]["Enums"]["attendance_session_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attendance_date: string;
          created_at?: string;
          created_by: string;
          id?: string;
          locked_at?: string | null;
          school_id: string;
          section_id: string;
          status?: Database["public"]["Enums"]["attendance_session_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Update: {
          attendance_date?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          locked_at?: string | null;
          school_id?: string;
          section_id?: string;
          status?: Database["public"]["Enums"]["attendance_session_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_section_id_school_id_fkey";
            columns: ["section_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "attendance_sessions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity_id: string | null;
          entity_type: string;
          id: number;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          school_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          academic_year_id: string;
          created_at: string;
          id: string;
          name: string;
          school_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year_id: string;
          created_at?: string;
          id?: string;
          name: string;
          school_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          school_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_school_id_fkey";
            columns: ["academic_year_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      notification_jobs: {
        Row: {
          attempts: number;
          attendance_date: string;
          attendance_record_id: string;
          created_at: string;
          dedupe_key: string;
          delivered_at: string | null;
          failed_at: string | null;
          id: string;
          last_error: string | null;
          max_attempts: number;
          next_attempt_at: string;
          provider_message_id: string | null;
          read_at: string | null;
          recipient_phone: string;
          school_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          student_id: string;
          template_language: Database["public"]["Enums"]["app_language"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          attendance_date: string;
          attendance_record_id: string;
          created_at?: string;
          dedupe_key: string;
          delivered_at?: string | null;
          failed_at?: string | null;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          provider_message_id?: string | null;
          read_at?: string | null;
          recipient_phone: string;
          school_id: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          student_id: string;
          template_language: Database["public"]["Enums"]["app_language"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          attendance_date?: string;
          attendance_record_id?: string;
          created_at?: string;
          dedupe_key?: string;
          delivered_at?: string | null;
          failed_at?: string | null;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          provider_message_id?: string | null;
          read_at?: string | null;
          recipient_phone?: string;
          school_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          student_id?: string;
          template_language?: Database["public"]["Enums"]["app_language"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_jobs_attendance_record_id_fkey";
            columns: ["attendance_record_id"];
            isOneToOne: false;
            referencedRelation: "attendance_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_jobs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_jobs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["app_role"];
          school_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["app_role"];
          school_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          created_at: string;
          default_language: Database["public"]["Enums"]["app_language"];
          id: string;
          name: string;
          name_hi: string | null;
          timezone: string;
          updated_at: string;
          whatsapp_enabled: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_language?: Database["public"]["Enums"]["app_language"];
          id?: string;
          name: string;
          name_hi?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Update: {
          created_at?: string;
          default_language?: Database["public"]["Enums"]["app_language"];
          id?: string;
          name?: string;
          name_hi?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          academic_year_id: string;
          class_id: string;
          created_at: string;
          id: string;
          name: string;
          school_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year_id: string;
          class_id: string;
          created_at?: string;
          id?: string;
          name: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string;
          class_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sections_class_id_school_id_academic_year_id_fkey";
            columns: ["class_id", "school_id", "academic_year_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "school_id", "academic_year_id"];
          },
        ];
      };
      students: {
        Row: {
          admission_no: string;
          class_id: string;
          created_at: string;
          enrollment_status: Database["public"]["Enums"]["enrollment_status"];
          full_name: string;
          guardian_name: string | null;
          guardian_notifications_consent: boolean;
          guardian_phone: string | null;
          id: string;
          preferred_language: Database["public"]["Enums"]["app_language"];
          roll_no: number | null;
          school_id: string;
          section_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admission_no: string;
          class_id: string;
          created_at?: string;
          enrollment_status?: Database["public"]["Enums"]["enrollment_status"];
          full_name: string;
          guardian_name?: string | null;
          guardian_notifications_consent?: boolean;
          guardian_phone?: string | null;
          id?: string;
          preferred_language?: Database["public"]["Enums"]["app_language"];
          roll_no?: number | null;
          school_id: string;
          section_id: string;
          updated_at?: string;
        };
        Update: {
          admission_no?: string;
          class_id?: string;
          created_at?: string;
          enrollment_status?: Database["public"]["Enums"]["enrollment_status"];
          full_name?: string;
          guardian_name?: string | null;
          guardian_notifications_consent?: boolean;
          guardian_phone?: string | null;
          id?: string;
          preferred_language?: Database["public"]["Enums"]["app_language"];
          roll_no?: number | null;
          school_id?: string;
          section_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_class_id_school_id_fkey";
            columns: ["class_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_section_id_class_id_fkey";
            columns: ["section_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      teacher_assignments: {
        Row: {
          academic_year_id: string;
          created_at: string;
          id: string;
          school_id: string;
          section_id: string;
          teacher_id: string;
        };
        ComputedFields: never;
        Insert: {
          academic_year_id: string;
          created_at?: string;
          id?: string;
          school_id: string;
          section_id: string;
          teacher_id: string;
        };
        Update: {
          academic_year_id?: string;
          created_at?: string;
          id?: string;
          school_id?: string;
          section_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_section_id_school_id_academic_year_id_fkey";
            columns: ["section_id", "school_id", "academic_year_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id", "school_id", "academic_year_id"];
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_school_id_fkey";
            columns: ["teacher_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_whatsapp_status: {
        Args: { p_at?: string; p_error?: string; p_provider_message_id: string; p_status: string };
        Returns: boolean;
      };
      claim_notification_jobs: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          attendance_date: string;
          class_label: string;
          id: string;
          recipient_phone: string;
          student_name: string;
          template_language: Database["public"]["Enums"]["app_language"];
        }[];
      };
      complete_notification_job: {
        Args: { p_error?: string; p_job_id: string; p_outcome: string; p_provider_message_id?: string };
        Returns: undefined;
      };
      correct_attendance_record: {
        Args: {
          p_reason: string;
          p_session_id: string;
          p_status: Database["public"]["Enums"]["attendance_status"];
          p_student_id: string;
        };
        Returns: {
          id: string;
          marked_at: string;
          marked_by: string;
          section_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance_records";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      lock_attendance_session: {
        Args: { p_session_id: string };
        Returns: {
          attendance_date: string;
          created_at: string;
          created_by: string;
          id: string;
          locked_at: string | null;
          school_id: string;
          section_id: string;
          status: Database["public"]["Enums"]["attendance_session_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      open_attendance_session: {
        Args: { p_date: string; p_section_id: string };
        Returns: {
          attendance_date: string;
          created_at: string;
          created_by: string;
          id: string;
          locked_at: string | null;
          school_id: string;
          section_id: string;
          status: Database["public"]["Enums"]["attendance_session_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_attendance_draft: { Args: { p_records: Json; p_session_id: string }; Returns: number };
      submit_attendance_session: {
        Args: { p_records: Json; p_session_id: string };
        Returns: {
          attendance_date: string;
          created_at: string;
          created_by: string;
          id: string;
          locked_at: string | null;
          school_id: string;
          section_id: string;
          status: Database["public"]["Enums"]["attendance_session_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_language: "en" | "hi";
      app_role: "admin" | "teacher";
      attendance_session_status: "draft" | "submitted" | "locked";
      attendance_status: "present" | "absent" | "late" | "excused";
      enrollment_status: "active" | "inactive" | "transferred";
      notification_status: "queued" | "processing" | "sent" | "delivered" | "read" | "failed" | "cancelled" | "skipped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_language: ["en", "hi"],
      app_role: ["admin", "teacher"],
      attendance_session_status: ["draft", "submitted", "locked"],
      attendance_status: ["present", "absent", "late", "excused"],
      enrollment_status: ["active", "inactive", "transferred"],
      notification_status: ["queued", "processing", "sent", "delivered", "read", "failed", "cancelled", "skipped"],
    },
  },
} as const;
