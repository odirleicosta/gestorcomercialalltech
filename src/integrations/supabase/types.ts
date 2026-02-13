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
      calculations: {
        Row: {
          created_at: string
          desired_margin_percent: number
          estimated_profit: number
          estimated_tax_percent: number
          estimated_tax_value: number
          fob_cost: number
          id: string
          machine_name: string
          min_acceptable_margin: number | null
          observation: string | null
          real_margin_percent: number | null
          real_profit: number | null
          real_tax_value: number | null
          selling_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desired_margin_percent?: number
          estimated_profit?: number
          estimated_tax_percent?: number
          estimated_tax_value?: number
          fob_cost?: number
          id?: string
          machine_name?: string
          min_acceptable_margin?: number | null
          observation?: string | null
          real_margin_percent?: number | null
          real_profit?: number | null
          real_tax_value?: number | null
          selling_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desired_margin_percent?: number
          estimated_profit?: number
          estimated_tax_percent?: number
          estimated_tax_value?: number
          fob_cost?: number
          id?: string
          machine_name?: string
          min_acceptable_margin?: number | null
          observation?: string | null
          real_margin_percent?: number | null
          real_profit?: number | null
          real_tax_value?: number | null
          selling_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_history: {
        Row: {
          changed_at: string
          deal_id: string
          field_changed: string
          id: string
          new_value: number
          old_value: number
          user_id: string
        }
        Insert: {
          changed_at?: string
          deal_id: string
          field_changed: string
          id?: string
          new_value: number
          old_value: number
          user_id: string
        }
        Update: {
          changed_at?: string
          deal_id?: string
          field_changed?: string
          id?: string
          new_value?: number
          old_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          base_price: number
          client_name: string
          closed_at: string | null
          commission_base: string
          created_at: string
          desired_margin_percent: number
          dollar_rate: number
          empresa_id: string | null
          estimated_tax_percent: number
          estimated_tax_value: number
          final_price: number
          fob_cost: number
          gross_margin_percent: number
          gross_profit: number
          id: string
          machine_name: string
          machine_type: string
          manager_commission_pct: number
          manager_commission_value: number
          modelo_id: string | null
          net_margin_percent: number
          net_profit: number
          observation: string | null
          representative_id: string | null
          seller_commission_pct: number
          seller_commission_value: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price?: number
          client_name: string
          closed_at?: string | null
          commission_base?: string
          created_at?: string
          desired_margin_percent?: number
          dollar_rate?: number
          empresa_id?: string | null
          estimated_tax_percent?: number
          estimated_tax_value?: number
          final_price?: number
          fob_cost?: number
          gross_margin_percent?: number
          gross_profit?: number
          id?: string
          machine_name?: string
          machine_type?: string
          manager_commission_pct?: number
          manager_commission_value?: number
          modelo_id?: string | null
          net_margin_percent?: number
          net_profit?: number
          observation?: string | null
          representative_id?: string | null
          seller_commission_pct?: number
          seller_commission_value?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number
          client_name?: string
          closed_at?: string | null
          commission_base?: string
          created_at?: string
          desired_margin_percent?: number
          dollar_rate?: number
          empresa_id?: string | null
          estimated_tax_percent?: number
          estimated_tax_value?: number
          final_price?: number
          fob_cost?: number
          gross_margin_percent?: number
          gross_profit?: number
          id?: string
          machine_name?: string
          machine_type?: string
          manager_commission_pct?: number
          manager_commission_value?: number
          modelo_id?: string | null
          net_margin_percent?: number
          net_profit?: number
          observation?: string | null
          representative_id?: string | null
          seller_commission_pct?: number
          seller_commission_value?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "machine_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      machine_catalog: {
        Row: {
          created_at: string
          custo_fob: number
          id: string
          informado_por: string | null
          marca: string
          modelo: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custo_fob?: number
          id?: string
          informado_por?: string | null
          marca: string
          modelo: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custo_fob?: number
          id?: string
          informado_por?: string | null
          marca?: string
          modelo?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_goals: {
        Row: {
          ano: number
          created_at: string
          id: string
          machine_type: string
          mes: number
          meta_quantidade: number
          meta_valor: number
          representative_id: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          machine_type?: string
          mes: number
          meta_quantidade?: number
          meta_valor?: number
          representative_id: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          machine_type?: string
          mes?: number
          meta_quantidade?: number
          meta_valor?: number
          representative_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_commission_base: string
          default_manager_commission_pct: number
          default_seller_commission_pct: number
          display_name: string | null
          email: string | null
          id: string
          min_acceptable_margin: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_commission_base?: string
          default_manager_commission_pct?: number
          default_seller_commission_pct?: number
          display_name?: string | null
          email?: string | null
          id: string
          min_acceptable_margin?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_commission_base?: string
          default_manager_commission_pct?: number
          default_seller_commission_pct?: number
          display_name?: string | null
          email?: string | null
          id?: string
          min_acceptable_margin?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      representatives: {
        Row: {
          comissao_gestor_pct: number
          comissao_padrao_pct: number
          created_at: string
          id: string
          meta_mensal_padrao: number
          meta_quantidade: number
          nome: string
          observacoes: string | null
          regiao: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comissao_gestor_pct?: number
          comissao_padrao_pct?: number
          created_at?: string
          id?: string
          meta_mensal_padrao?: number
          meta_quantidade?: number
          nome: string
          observacoes?: string | null
          regiao?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comissao_gestor_pct?: number
          comissao_padrao_pct?: number
          created_at?: string
          id?: string
          meta_mensal_padrao?: number
          meta_quantidade?: number
          nome?: string
          observacoes?: string | null
          regiao?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_visits: {
        Row: {
          ano: number
          created_at: string
          id: string
          meta: number
          quantidade: number
          representative_id: string
          semana: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          meta?: number
          quantidade?: number
          representative_id: string
          semana: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          meta?: number
          quantidade?: number
          representative_id?: string
          semana?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_visits_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_calculation_owner: { Args: { calc_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
