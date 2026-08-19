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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agreements: {
        Row: {
          agreement_number: string
          created_at: string
          doc: Json
          document_hash: string | null
          estimate_id: string | null
          id: string
          quote_id: string
          review_token: string
          sent_at: string | null
          signed_at: string | null
          signed_pdf_path: string | null
          signer_email: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          agreement_number?: string
          created_at?: string
          doc?: Json
          document_hash?: string | null
          estimate_id?: string | null
          id?: string
          quote_id: string
          review_token?: string
          sent_at?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          total_cents?: number
          updated_at?: string
        }
        Update: {
          agreement_number?: string
          created_at?: string
          doc?: Json
          document_hash?: string | null
          estimate_id?: string | null
          id?: string
          quote_id?: string
          review_token?: string
          sent_at?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      documents: {
        Row: {
          byte_size: number
          created_at: string
          entity: string
          entity_id: string
          format: string
          id: string
          kind: string
          quote_id: string
          sha256: string | null
          storage_path: string
        }
        Insert: {
          byte_size?: number
          created_at?: string
          entity: string
          entity_id: string
          format: string
          id?: string
          kind: string
          quote_id: string
          sha256?: string | null
          storage_path: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          entity?: string
          entity_id?: string
          format?: string
          id?: string
          kind?: string
          quote_id?: string
          sha256?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          created_at: string
          discount_cents: number
          doc: Json
          duration_note: string | null
          expires_at: string | null
          id: string
          line_items: Json
          proposal_id: string | null
          quote_id: string
          responded_at: string | null
          response_note: string | null
          review_token: string
          sent_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_cents?: number
          doc?: Json
          duration_note?: string | null
          expires_at?: string | null
          id?: string
          line_items?: Json
          proposal_id?: string | null
          quote_id: string
          responded_at?: string | null
          response_note?: string | null
          review_token?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_cents?: number
          doc?: Json
          duration_note?: string | null
          expires_at?: string | null
          id?: string
          line_items?: Json
          proposal_id?: string | null
          quote_id?: string
          responded_at?: string | null
          response_note?: string | null
          review_token?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          fees: Json
          hyperswitch_connector: string | null
          hyperswitch_payment_id: string | null
          id: string
          invoice_id: string
          metadata: Json
          paid_at: string | null
          payment_method: string | null
          payment_reference: string
          processor_transaction_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          fees?: Json
          hyperswitch_connector?: string | null
          hyperswitch_payment_id?: string | null
          id?: string
          invoice_id: string
          metadata?: Json
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string
          processor_transaction_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          fees?: Json
          hyperswitch_connector?: string | null
          hyperswitch_payment_id?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string
          processor_transaction_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          agreement_id: string
          amount_cents: number
          amount_paid_cents: number
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string | null
          paid_at: string | null
          paused: boolean
          pay_token: string
          quote_id: string
          scheduled_send_at: string | null
          sent_at: string | null
          sequence: number
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          agreement_id: string
          amount_cents: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          paid_at?: string | null
          paused?: boolean
          pay_token?: string
          quote_id: string
          scheduled_send_at?: string | null
          sent_at?: string | null
          sequence: number
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          agreement_id?: string
          amount_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          paid_at?: string | null
          paused?: boolean
          pay_token?: string
          quote_id?: string
          scheduled_send_at?: string | null
          sent_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          event_id: string
          event_payload: Json
          event_type: string
          id: string
          invoice_payment_id: string | null
          processed_at: string | null
          received_at: string
          signature_verified: boolean
        }
        Insert: {
          event_id: string
          event_payload?: Json
          event_type: string
          id?: string
          invoice_payment_id?: string | null
          processed_at?: string | null
          received_at?: string
          signature_verified?: boolean
        }
        Update: {
          event_id?: string
          event_payload?: Json
          event_type?: string
          id?: string
          invoice_payment_id?: string | null
          processed_at?: string | null
          received_at?: string
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_invoice_payment_id_fkey"
            columns: ["invoice_payment_id"]
            isOneToOne: false
            referencedRelation: "invoice_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_id: string
          metadata: Json
          provider: string
          provider_ref: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          invoice_id: string
          metadata?: Json
          provider?: string
          provider_ref?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string
          metadata?: Json
          provider?: string
          provider_ref?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          change_request: string | null
          content: string
          created_at: string
          doc: Json | null
          id: string
          proposal_id: string
          version: number
        }
        Insert: {
          change_request?: string | null
          content: string
          created_at?: string
          doc?: Json | null
          id?: string
          proposal_id: string
          version: number
        }
        Update: {
          change_request?: string | null
          content?: string
          created_at?: string
          doc?: Json | null
          id?: string
          proposal_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_response_note: string | null
          content: string
          created_at: string
          doc: Json | null
          expires_at: string | null
          id: string
          model: string
          prompt: string
          quote_id: string
          reminder_sent_at: string | null
          responded_at: string | null
          review_token: string
          reviewed_by: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
          version: number
        }
        Insert: {
          client_response_note?: string | null
          content: string
          created_at?: string
          doc?: Json | null
          expires_at?: string | null
          id?: string
          model: string
          prompt: string
          quote_id: string
          reminder_sent_at?: string | null
          responded_at?: string | null
          review_token?: string
          reviewed_by?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          client_response_note?: string | null
          content?: string
          created_at?: string
          doc?: Json | null
          expires_at?: string | null
          id?: string
          model?: string
          prompt?: string
          quote_id?: string
          reminder_sent_at?: string | null
          responded_at?: string | null
          review_token?: string
          reviewed_by?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_files: {
        Row: {
          byte_size: number
          created_at: string
          id: string
          mime_type: string
          original_name: string
          quote_id: string
          scan_status: string
          storage_path: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          quote_id: string
          scan_status?: string
          storage_path: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          quote_id?: string
          scan_status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          budget: string
          company: string | null
          consent: boolean
          contact_email: string
          contact_name: string
          created_at: string
          deleted_at: string | null
          features: string | null
          goals: string
          id: string
          industry: string
          internal_notes: string | null
          phone: string | null
          project_type: string
          quote_number: string
          services: string[]
          source_ip: string | null
          status: Database["public"]["Enums"]["quote_status"]
          timeline: string
          updated_at: string
        }
        Insert: {
          budget: string
          company?: string | null
          consent?: boolean
          contact_email: string
          contact_name: string
          created_at?: string
          deleted_at?: string | null
          features?: string | null
          goals: string
          id?: string
          industry: string
          internal_notes?: string | null
          phone?: string | null
          project_type: string
          quote_number?: string
          services?: string[]
          source_ip?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          timeline: string
          updated_at?: string
        }
        Update: {
          budget?: string
          company?: string | null
          consent?: boolean
          contact_email?: string
          contact_name?: string
          created_at?: string
          deleted_at?: string | null
          features?: string | null
          goals?: string
          id?: string
          industry?: string
          internal_notes?: string | null
          phone?: string | null
          project_type?: string
          quote_number?: string
          services?: string[]
          source_ip?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          timeline?: string
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          hyperswitch_refund_id: string | null
          id: string
          initiated_by: string | null
          initiated_label: string | null
          invoice_payment_id: string
          processor_refund_id: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          hyperswitch_refund_id?: string | null
          id?: string
          initiated_by?: string | null
          initiated_label?: string | null
          invoice_payment_id: string
          processor_refund_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          hyperswitch_refund_id?: string | null
          id?: string
          initiated_by?: string | null
          initiated_label?: string | null
          invoice_payment_id?: string
          processor_refund_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_invoice_payment_id_fkey"
            columns: ["invoice_payment_id"]
            isOneToOne: false
            referencedRelation: "invoice_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      next_agreement_number: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
      next_quote_number: { Args: never; Returns: string }
      viewer_email: { Args: never; Returns: string }
    }
    Enums: {
      agreement_status: "draft" | "sent" | "signed" | "void"
      app_role: "admin" | "staff" | "user"
      estimate_status: "draft" | "sent" | "approved" | "declined" | "expired"
      invoice_status:
        | "scheduled"
        | "sent"
        | "paid"
        | "void"
        | "draft"
        | "viewed"
        | "partially_paid"
        | "overdue"
        | "cancelled"
      proposal_status:
        | "draft"
        | "sent"
        | "approved"
        | "changes_requested"
        | "declined"
      quote_status:
        | "new"
        | "reviewing"
        | "proposal_draft"
        | "proposal_sent"
        | "approved"
        | "declined"
        | "estimate_draft"
        | "estimate_sent"
        | "estimate_approved"
        | "contract_sent"
        | "signed"
        | "invoicing"
        | "completed"
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
      agreement_status: ["draft", "sent", "signed", "void"],
      app_role: ["admin", "staff", "user"],
      estimate_status: ["draft", "sent", "approved", "declined", "expired"],
      invoice_status: [
        "scheduled",
        "sent",
        "paid",
        "void",
        "draft",
        "viewed",
        "partially_paid",
        "overdue",
        "cancelled",
      ],
      proposal_status: [
        "draft",
        "sent",
        "approved",
        "changes_requested",
        "declined",
      ],
      quote_status: [
        "new",
        "reviewing",
        "proposal_draft",
        "proposal_sent",
        "approved",
        "declined",
        "estimate_draft",
        "estimate_sent",
        "estimate_approved",
        "contract_sent",
        "signed",
        "invoicing",
        "completed",
      ],
    },
  },
} as const
