import { supabase } from "@/integrations/supabase/client";
import type { ScoringResult } from "./creditScoring";

export const HISTORY_STORAGE_KEY = "credit_history";
export const MIGRATION_DONE_KEY = "credit_history_migration_done";

type AnaliseRow = {
  id?: string;
  cliente_id: string | null;
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
};

const toRow = (r: ScoringResult, userId: string | null): AnaliseRow => ({
  cliente_id: r.clienteId ?? null,
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
});

const fromRow = (row: any): ScoringResult => ({
  id: row.id,
  clienteId: row.cliente_id ?? null,
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

/** Salva a análise e devolve o id da linha criada (chave estável p/ updates). */
export const saveHistoryResult = async (result: ScoringResult): Promise<string> => {
  const userId = await getUserId();
  if (!userId) throw new Error("Usuário não autenticado");
  const row = toRow(result, userId);
  const { data, error } = await supabase
    .from("analises")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("Erro ao salvar análise:", error);
    throw error;
  }
  return (data as any).id as string;
};

export const updateHistoryResult = async (result: ScoringResult): Promise<void> => {
  const row = toRow(result, null);
  const { created_by: _omit, id: _id, ...rest } = row;
  // Atualiza pelo id (uuid) quando disponível; protocolo é só fallback legado
  let query = supabase.from("analises").update(rest);
  query = result.id ? query.eq("id", result.id) : query.eq("protocolo", result.protocolo);
  const { error } = await query;
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
