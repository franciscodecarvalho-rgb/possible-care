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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          ativa: boolean
          criada_em: string
          criada_por: string | null
          id: string
          key_hash: string
          nome: string
          prefixo: string
          revogada_em: string | null
          ultima_uso: string | null
        }
        Insert: {
          ativa?: boolean
          criada_em?: string
          criada_por?: string | null
          id?: string
          key_hash: string
          nome: string
          prefixo: string
          revogada_em?: string | null
          ultima_uso?: string | null
        }
        Update: {
          ativa?: boolean
          criada_em?: string
          criada_por?: string | null
          id?: string
          key_hash?: string
          nome?: string
          prefixo?: string
          revogada_em?: string | null
          ultima_uso?: string | null
        }
        Relationships: []
      }
      consultas_api: {
        Row: {
          analise_id: string | null
          api_key_id: string | null
          consultada_em: string
          id: string
          ip_origem: string | null
          protocolo: string
          resposta_json: Json | null
          status_http: number
        }
        Insert: {
          analise_id?: string | null
          api_key_id?: string | null
          consultada_em?: string
          id?: string
          ip_origem?: string | null
          protocolo: string
          resposta_json?: Json | null
          status_http: number
        }
        Update: {
          analise_id?: string | null
          api_key_id?: string | null
          consultada_em?: string
          id?: string
          ip_origem?: string | null
          protocolo?: string
          resposta_json?: Json | null
          status_http?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultas_api_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_api_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      analises: {
        Row: {
          breakdown: Json
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data: string
          decision: string
          decision_color: string
          extracted_data: Json
          form_data: Json
          id: string
          insufficient_data: boolean
          justificativa_ajuste: string | null
          limite_ajustado_manualmente: boolean | null
          limite_aprovado: number | null
          limite_sugerido: number | null
          manual_adjustment: Json | null
          parcelas_aprovadas: number | null
          parcelas_sugeridas: number | null
          pj_doc_type: string | null
          protocolo: string
          score: number
          score_original: number | null
          tipo: string
          updated_at: string
          validade_analise: string | null
        }
        Insert: {
          breakdown: Json
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          decision: string
          decision_color: string
          extracted_data: Json
          form_data: Json
          id?: string
          insufficient_data?: boolean
          justificativa_ajuste?: string | null
          limite_ajustado_manualmente?: boolean | null
          limite_aprovado?: number | null
          limite_sugerido?: number | null
          manual_adjustment?: Json | null
          parcelas_aprovadas?: number | null
          parcelas_sugeridas?: number | null
          pj_doc_type?: string | null
          protocolo: string
          score: number
          score_original?: number | null
          tipo: string
          updated_at?: string
          validade_analise?: string | null
        }
        Update: {
          breakdown?: Json
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          decision?: string
          decision_color?: string
          extracted_data?: Json
          form_data?: Json
          id?: string
          insufficient_data?: boolean
          justificativa_ajuste?: string | null
          limite_ajustado_manualmente?: boolean | null
          limite_aprovado?: number | null
          limite_sugerido?: number | null
          manual_adjustment?: Json | null
          parcelas_aprovadas?: number | null
          parcelas_sugeridas?: number | null
          pj_doc_type?: string | null
          protocolo?: string
          score?: number
          score_original?: number | null
          tipo?: string
          updated_at?: string
          validade_analise?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analises_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      bureaus: {
        Row: {
          analise_id: string
          bureau: string
          created_at: string
          created_by: string | null
          dados_extraidos: Json
          id: string
          pdf_filename: string | null
        }
        Insert: {
          analise_id: string
          bureau: string
          created_at?: string
          created_by?: string | null
          dados_extraidos: Json
          id?: string
          pdf_filename?: string | null
        }
        Update: {
          analise_id?: string
          bureau?: string
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          id?: string
          pdf_filename?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bureaus_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          created_by: string | null
          data_fundacao: string | null
          data_nascimento: string | null
          documento: string
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          endereco_uf: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          ocupacao: string | null
          porte: string | null
          rg: string | null
          status: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fundacao?: string | null
          data_nascimento?: string | null
          documento: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          ocupacao?: string | null
          porte?: string | null
          rg?: string | null
          status?: string
          telefone?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fundacao?: string | null
          data_nascimento?: string | null
          documento?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          ocupacao?: string | null
          porte?: string | null
          rg?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiadores: {
        Row: {
          analise_id: string
          breakdown: Json
          created_at: string
          created_by: string | null
          decision: string
          decision_color: string
          documento: string
          extracted_data: Json
          id: string
          insufficient_data: boolean
          nome: string
          pj_doc_type: string | null
          score: number
          tipo: string
          updated_at: string
        }
        Insert: {
          analise_id: string
          breakdown: Json
          created_at?: string
          created_by?: string | null
          decision: string
          decision_color: string
          documento: string
          extracted_data: Json
          id?: string
          insufficient_data?: boolean
          nome: string
          pj_doc_type?: string | null
          score: number
          tipo: string
          updated_at?: string
        }
        Update: {
          analise_id?: string
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          decision?: string
          decision_color?: string
          documento?: string
          extracted_data?: Json
          id?: string
          insufficient_data?: boolean
          nome?: string
          pj_doc_type?: string | null
          score?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiadores_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["id"]
          },
        ]
      }
      politicas_credito: {
        Row: {
          ativa: boolean
          conteudo: string
          criada_em: string
          criada_por: string | null
          id: string
          versao: number
        }
        Insert: {
          ativa?: boolean
          conteudo: string
          criada_em?: string
          criada_por?: string | null
          id?: string
          versao: number
        }
        Update: {
          ativa?: boolean
          conteudo?: string
          criada_em?: string
          criada_por?: string | null
          id?: string
          versao?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_admin: boolean
          nome: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_admin?: boolean
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          nome?: string | null
        }
        Relationships: []
      }
      sugestoes_config: {
        Row: {
          criada_em: string
          id: string
          politica_id: string | null
          resolvida_em: string | null
          resolvida_por: string | null
          status: string
          sugestoes: Json
        }
        Insert: {
          criada_em?: string
          id?: string
          politica_id?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          status?: string
          sugestoes: Json
        }
        Update: {
          criada_em?: string
          id?: string
          politica_id?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          status?: string
          sugestoes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sugestoes_config_politica_id_fkey"
            columns: ["politica_id"]
            isOneToOne: false
            referencedRelation: "politicas_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_config: {
        Row: {
          config: Json
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config: Json
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
