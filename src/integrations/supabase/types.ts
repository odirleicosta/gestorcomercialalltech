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
      auditoria_resultados: {
        Row: {
          criado_em: string
          descricao: string | null
          diferenca_valor: number
          id: string
          pedido: string
          relatorio_id: string
          status: Database["public"]["Enums"]["auditoria_status_enum"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          diferenca_valor?: number
          id?: string
          pedido: string
          relatorio_id: string
          status?: Database["public"]["Enums"]["auditoria_status_enum"]
          user_id: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          diferenca_valor?: number
          id?: string
          pedido?: string
          relatorio_id?: string
          status?: Database["public"]["Enums"]["auditoria_status_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_resultados_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      calculations: {
        Row: {
          client_name: string | null
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
          representative_id: string | null
          selling_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
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
          representative_id?: string | null
          selling_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
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
          representative_id?: string | null
          selling_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculations_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_deals: {
        Row: {
          city: string | null
          client_name: string
          competitor: string | null
          created_at: string
          deal_value: number
          empresa_id: string | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          lost_reason_detail: string | null
          machine_name: string
          machine_type: string
          main_objection: string | null
          motivo_perda: string | null
          motivo_perda_detalhe: string | null
          next_step: string | null
          notes: string | null
          probability: Database["public"]["Enums"]["closing_deal_probability"]
          quantity: number
          representative_id: string | null
          risk_reason: string | null
          sale_type: Database["public"]["Enums"]["closing_deal_sale_type"]
          stage: Database["public"]["Enums"]["closing_deal_stage"]
          start_date: string
          status: Database["public"]["Enums"]["closing_deal_status"]
          trade_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          client_name: string
          competitor?: string | null
          created_at?: string
          deal_value?: number
          empresa_id?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          lost_reason_detail?: string | null
          machine_name?: string
          machine_type?: string
          main_objection?: string | null
          motivo_perda?: string | null
          motivo_perda_detalhe?: string | null
          next_step?: string | null
          notes?: string | null
          probability?: Database["public"]["Enums"]["closing_deal_probability"]
          quantity?: number
          representative_id?: string | null
          risk_reason?: string | null
          sale_type?: Database["public"]["Enums"]["closing_deal_sale_type"]
          stage?: Database["public"]["Enums"]["closing_deal_stage"]
          start_date?: string
          status?: Database["public"]["Enums"]["closing_deal_status"]
          trade_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          client_name?: string
          competitor?: string | null
          created_at?: string
          deal_value?: number
          empresa_id?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          lost_reason_detail?: string | null
          machine_name?: string
          machine_type?: string
          main_objection?: string | null
          motivo_perda?: string | null
          motivo_perda_detalhe?: string | null
          next_step?: string | null
          notes?: string | null
          probability?: Database["public"]["Enums"]["closing_deal_probability"]
          quantity?: number
          representative_id?: string | null
          risk_reason?: string | null
          sale_type?: Database["public"]["Enums"]["closing_deal_sale_type"]
          stage?: Database["public"]["Enums"]["closing_deal_stage"]
          start_date?: string
          status?: Database["public"]["Enums"]["closing_deal_status"]
          trade_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closing_deals_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_deals_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_linhas: {
        Row: {
          cliente: string
          created_at: string
          empresa_origem: Database["public"]["Enums"]["empresa_origem_enum"]
          hash_linha: string
          id: string
          parcela_atual: number
          parcela_total: number
          pedido: string
          percentual_comissao: number
          produto: string
          relatorio_id: string
          user_id: string
          valor_comissao: number
          valor_fob: number
        }
        Insert: {
          cliente: string
          created_at?: string
          empresa_origem?: Database["public"]["Enums"]["empresa_origem_enum"]
          hash_linha: string
          id?: string
          parcela_atual?: number
          parcela_total?: number
          pedido: string
          percentual_comissao?: number
          produto: string
          relatorio_id: string
          user_id: string
          valor_comissao?: number
          valor_fob?: number
        }
        Update: {
          cliente?: string
          created_at?: string
          empresa_origem?: Database["public"]["Enums"]["empresa_origem_enum"]
          hash_linha?: string
          id?: string
          parcela_atual?: number
          parcela_total?: number
          pedido?: string
          percentual_comissao?: number
          produto?: string
          relatorio_id?: string
          user_id?: string
          valor_comissao?: number
          valor_fob?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_linhas_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_mensais"
            referencedColumns: ["id"]
          },
        ]
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
      deal_items: {
        Row: {
          created_at: string
          deal_id: string
          fob_cost: number
          gross_margin_percent: number
          gross_profit: number
          id: string
          machine_name: string
          machine_type: string
          modelo_id: string | null
          preco_venda_fob: number
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          fob_cost?: number
          gross_margin_percent?: number
          gross_profit?: number
          id?: string
          machine_name?: string
          machine_type?: string
          modelo_id?: string | null
          preco_venda_fob?: number
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          fob_cost?: number
          gross_margin_percent?: number
          gross_profit?: number
          id?: string
          machine_name?: string
          machine_type?: string
          modelo_id?: string | null
          preco_venda_fob?: number
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "machine_catalog"
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
          cidade: string | null
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          created_at: string
          descricao: string
          id: string
          prioridade: string
          representative_id: string
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          prioridade?: string
          representative_id: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          prioridade?: string
          representative_id?: string
          resolved_at?: string | null
          status?: string
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
          preco_venda_fob: number
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
          preco_venda_fob?: number
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
          preco_venda_fob?: number
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
      monthly_opportunities: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          quantidade: number
          representative_id: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          quantidade?: number
          representative_id: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          quantidade?: number
          representative_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          commission_password: string | null
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
          commission_password?: string | null
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
          commission_password?: string | null
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
      relatorios_mensais: {
        Row: {
          arquivo_pdf_url: string | null
          data_upload: string
          id: string
          mes_referencia: string
          total_allservice: number
          total_alltech: number
          total_geral: number
          user_id: string
        }
        Insert: {
          arquivo_pdf_url?: string | null
          data_upload?: string
          id?: string
          mes_referencia: string
          total_allservice?: number
          total_alltech?: number
          total_geral?: number
          user_id: string
        }
        Update: {
          arquivo_pdf_url?: string | null
          data_upload?: string
          id?: string
          mes_referencia?: string
          total_allservice?: number
          total_alltech?: number
          total_geral?: number
          user_id?: string
        }
        Relationships: []
      }
      representatives: {
        Row: {
          comissao_gestor_pct: number
          comissao_padrao_pct: number
          created_at: string
          id: string
          is_gestor: boolean
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
          is_gestor?: boolean
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
          is_gestor?: boolean
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
      strategic_plans: {
        Row: {
          ano: number
          created_at: string
          dollar_rate: number | null
          id: string
          is_active: boolean
          margin_pct: number
          mes: number
          name: string
          planned_commission: number
          planned_fob: number
          planned_gross_profit: number
          planned_meta_pct: number
          planned_net_profit: number
          qty_machines: number
          representative_id: string | null
          ticket_fob: number
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          dollar_rate?: number | null
          id?: string
          is_active?: boolean
          margin_pct?: number
          mes: number
          name?: string
          planned_commission?: number
          planned_fob?: number
          planned_gross_profit?: number
          planned_meta_pct?: number
          planned_net_profit?: number
          qty_machines?: number
          representative_id?: string | null
          ticket_fob?: number
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          dollar_rate?: number | null
          id?: string
          is_active?: boolean
          margin_pct?: number
          mes?: number
          name?: string
          planned_commission?: number
          planned_fob?: number
          planned_gross_profit?: number
          planned_meta_pct?: number
          planned_net_profit?: number
          qty_machines?: number
          representative_id?: string | null
          ticket_fob?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_plans_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
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
      auditoria_status_enum: "OK" | "ALERTA" | "ERRO"
      closing_deal_probability: "Baixa" | "Média" | "Alta"
      closing_deal_sale_type: "Rentall" | "Venda Direta"
      closing_deal_stage:
        | "Proposta Enviada"
        | "Negociação Ativa"
        | "Decisão Próxima"
      closing_deal_status: "ativa" | "ganha" | "perdida"
      empresa_origem_enum: "ALLTECH" | "ALLSERVICE"
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
      auditoria_status_enum: ["OK", "ALERTA", "ERRO"],
      closing_deal_probability: ["Baixa", "Média", "Alta"],
      closing_deal_sale_type: ["Rentall", "Venda Direta"],
      closing_deal_stage: [
        "Proposta Enviada",
        "Negociação Ativa",
        "Decisão Próxima",
      ],
      closing_deal_status: ["ativa", "ganha", "perdida"],
      empresa_origem_enum: ["ALLTECH", "ALLSERVICE"],
    },
  },
} as const
