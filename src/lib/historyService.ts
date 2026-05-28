import { supabase } from "@/integrations/supabase/client";
import type { ScoringResult } from "./creditScoring";

export const HISTORY_STORAGE_KEY = "credit_history";
export const MIGRATION_DONE_KEY = "credit_history_migration_done";

type AnaliseRow = {
  id?: string;
  protocolo: string;
  tipo: string;
  pj_doc_type: string | null;
  score: number;
  score_original: number | null;
  decision: string;
  decision_color: string;
  insufficient_data: boolean;
  extracted_data: Record<string, any>;
  form_data: Record<string, any>;
  breakdown: any[];
  manual_adjustment: any | null;
  data: string;
  created_by?: string | null;
  cliente_id?: string | null;
  limite_sugerido: number | null;
  parcelas_sugeridas: number | null;
  validade_analise: string | null;
  limite_aprovado: number | null;
  parcelas_aprovadas: number | null;
  limite_ajustado_manualmente: boolean | null;
  justificativa_ajuste: string | null;
};

const toRow = (
  r: ScoringResult,
  userId: string | null,
  clienteId: string | null = null,
): AnaliseRow => ({
  protocolo: r.protocolo,
  tipo: r.tipo,
  pj_doc_type: r.pjDocType ?? null,
  score: r.score,
  score_original: r.originalScore ?? null,
  decision: r.decision,
  decision_color: r.decisionColor,
  insufficient_data: r.insufficientData,
  extracted_data: r.extractedData,
  form_data: r.formData as any,
  breakdown: r.breakdown,
  manual_adjustment: r.manualAdjustment ?? null,
  data: r.data,
  created_by: userId,
  cliente_id: clienteId,
  limite_sugerido: r.limiteSugerido ?? null,
  parcelas_sugeridas: r.parcelasSugeridas ?? null,
  validade_analise: r.validadeAnalise ?? null,
  limite_aprovado: r.limiteAprovado ?? null,
  parcelas_aprovadas: r.parcelasAprovadas ?? null,
  limite_ajustado_manualmente: r.limiteAjustadoManualmente ?? false,
  justificativa_ajuste: r.justificativaAjuste ?? null,
});

const fromRow = (row: any): ScoringResult => ({
  id: row.id,
  protocolo: row.protocolo,
  tipo: row.tipo,
  pjDocType: row.pj_doc_type ?? undefined,
  score: row.score,
  originalScore: row.score_original ?? undefined,
  decision: row.decision,
  decisionColor: row.decision_color,
  insufficientData: row.insufficient_data,
  extractedData: row.extracted_data ?? {},
  formData: row.form_data ?? { valor: 0, prazo: 0, finalidade: "" },
  breakdown: row.breakdown ?? [],
  manualAdjustment: row.manual_adjustment ?? undefined,
  data: row.data,
  clienteId: row.cliente_id ?? null,
  limiteSugerido: row.limite_sugerido ?? null,
  parcelasSugeridas: row.parcelas_sugeridas ?? null,
  validadeAnalise: row.validade_analise ?? null,
  limiteAprovado: row.limite_aprovado ?? null,
  parcelasAprovadas: row.parcelas_aprovadas ?? null,
  limiteAjustadoManualmente: row.limite_ajustado_manualmente ?? false,
  justificativaAjuste: row.justificativa_ajuste ?? null,
});

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export const loadHistory = async (): Promise<ScoringResult[]> => {
  const { data, error } = await supabase
    .from("analises")
    .select("*")
    .order("data", { ascending: false });
  if (error) {
    console.error("Erro ao carregar histórico:", error);
    throw error;
  }
  return (data ?? []).map(fromRow);
};

export const saveHistoryResult = async (
  result: ScoringResult,
  clienteId: string | null = null,
): Promise<{ id: string }> => {
  const userId = await getUserId();
  if (!userId) throw new Error("Usuário não autenticado");
  const row = toRow(result, userId, clienteId ?? result.clienteId ?? null);
  const { data, error } = await supabase
    .from("analises")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("Erro ao salvar análise:", error);
    throw error;
  }
  return { id: data.id as string };
};

export const updateHistoryResult = async (result: ScoringResult): Promise<void> => {
  const row = toRow(result, null);
  const { created_by: _omit, ...rest } = row;
  const { error } = await supabase
    .from("analises")
    .update(rest)
    .eq("protocolo", result.protocolo);
  if (error) {
    console.error("Erro ao atualizar análise:", error);
    throw error;
  }
};

export const getExistingProtocolos = async (protocolos: string[]): Promise<Set<string>> => {
  if (protocolos.length === 0) return new Set();
  const { data, error } = await supabase
    .from("analises")
    .select("protocolo")
    .in("protocolo", protocolos);
  if (error) {
    console.error("Erro ao verificar protocolos existentes:", error);
    throw error;
  }
  return new Set((data ?? []).map((r: any) => r.protocolo));
};

// ---- Local storage helpers (used only by the migration banner) ----

const isValidHistoryItem = (item: unknown): item is ScoringResult => {
  if (!item || typeof item !== "object") return false;
  const r = item as Partial<ScoringResult>;
  return Boolean(r.protocolo && r.data && r.tipo && typeof r.score === "number" && Array.isArray(r.breakdown));
};

export const loadLocalHistory = (): ScoringResult[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHistoryItem);
  } catch (e) {
    console.error("Erro ao ler localStorage:", e);
    return [];
  }
};

export const clearLocalHistory = () => {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
};
