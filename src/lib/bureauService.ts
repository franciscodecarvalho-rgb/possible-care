import { supabase } from "@/integrations/supabase/client";

export type BureauTipo = "serasa" | "boa_vista";

export interface BureauPefinItem {
  credor: string | null;
  valor: number | null;
  data: string | null;
  status: string | null;
}

export interface BureauRefinItem {
  credor: string | null;
  valor: number | null;
  data: string | null;
}

export interface BureauProtestoItem {
  cartorio: string | null;
  valor: number | null;
  data: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface BureauAcaoJudicialItem {
  tribunal: string | null;
  numero: string | null;
  tipo: string | null;
  data: string | null;
}

export interface BureauExtractedData {
  nome_consultado: string | null;
  documento_consultado: string | null;
  data_nascimento_fundacao: string | null;
  data_consulta: string | null;

  score_valor: number | null;
  score_classificacao: string | null;
  probabilidade_inadimplencia: number | null;

  pefin: {
    quantidade: number | null;
    valor_total: number | null;
    lista: BureauPefinItem[] | null;
  } | null;
  refin: {
    quantidade: number | null;
    valor_total: number | null;
    lista: BureauRefinItem[] | null;
  } | null;
  protestos: {
    quantidade: number | null;
    valor_total: number | null;
    lista: BureauProtestoItem[] | null;
  } | null;
  acoes_judiciais: {
    quantidade: number | null;
    valor_total: number | null;
    lista: BureauAcaoJudicialItem[] | null;
  } | null;
  ccf_cheques_sem_fundo: {
    quantidade: number | null;
    valor_total: number | null;
  } | null;

  consultas_recentes: {
    ultimos_30_dias: number | null;
    ultimos_90_dias: number | null;
    ultimos_180_dias: number | null;
  } | null;
  participacoes_societarias: string[] | null;
  socios: string[] | null;
  anotacoes_internas: string[] | null;

  enderecos_conhecidos: string[] | null;
  telefones_conhecidos: string[] | null;

  indicadores_setoriais: string | null;
  outros_dados: string | null;
}

export interface Bureau {
  id: string;
  analise_id: string;
  bureau: BureauTipo;
  dados_extraidos: BureauExtractedData;
  pdf_filename: string | null;
  created_by: string | null;
  created_at: string;
}

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export async function salvarBureau(
  analiseId: string,
  bureau: BureauTipo,
  dadosExtraidos: BureauExtractedData | Record<string, unknown>,
  filename: string | null,
): Promise<Bureau> {
  const uid = await getUserId();
  if (!uid) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("bureaus")
    .insert({
      analise_id: analiseId,
      bureau,
      dados_extraidos: dadosExtraidos as any,
      pdf_filename: filename,
      created_by: uid,
    })
    .select("*")
    .single();

  if (error) {
    console.error("salvarBureau:", error);
    throw new Error(error.message || "Erro ao salvar bureau.");
  }
  return data as unknown as Bureau;
}

export async function obterBureauDaAnalise(analiseId: string): Promise<Bureau | null> {
  const { data, error } = await supabase
    .from("bureaus")
    .select("*")
    .eq("analise_id", analiseId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("obterBureauDaAnalise:", error);
    throw new Error(error.message || "Erro ao carregar bureau.");
  }
  return ((data && data[0]) as unknown as Bureau) ?? null;
}
