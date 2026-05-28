import { supabase } from "@/integrations/supabase/client";
import type { ScoreBreakdown } from "./creditScoring";

export interface Fiador {
  id: string;
  analise_id: string;
  tipo: "pf" | "pj";
  pj_doc_type: string | null;
  nome: string;
  documento: string;
  score: number;
  decision: string;
  decision_color: string;
  insufficient_data: boolean;
  extracted_data: Record<string, any>;
  breakdown: ScoreBreakdown[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiadorInput {
  analise_id: string;
  tipo: "pf" | "pj";
  pj_doc_type?: string | null;
  nome: string;
  documento: string;
  score: number;
  decision: string;
  decision_color: string;
  insufficient_data: boolean;
  extracted_data: Record<string, any>;
  breakdown: ScoreBreakdown[];
}

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export async function criarFiador(dados: FiadorInput): Promise<Fiador> {
  const uid = await getUserId();
  if (!uid) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("fiadores")
    .insert({
      analise_id: dados.analise_id,
      tipo: dados.tipo,
      pj_doc_type: dados.pj_doc_type ?? null,
      nome: dados.nome,
      documento: dados.documento,
      score: dados.score,
      decision: dados.decision,
      decision_color: dados.decision_color,
      insufficient_data: dados.insufficient_data,
      extracted_data: dados.extracted_data as any,
      breakdown: dados.breakdown as any,
      created_by: uid,
    })
    .select("*")
    .single();

  if (error) {
    console.error("criarFiador:", error);
    throw new Error(error.message || "Erro ao salvar fiador.");
  }
  return data as unknown as Fiador;
}

export async function listarFiadores(analiseId: string): Promise<Fiador[]> {
  const { data, error } = await supabase
    .from("fiadores")
    .select("*")
    .eq("analise_id", analiseId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listarFiadores:", error);
    throw new Error(error.message || "Erro ao carregar fiadores.");
  }
  return (data ?? []) as unknown as Fiador[];
}

export async function atualizarFiador(
  id: string,
  dados: Partial<FiadorInput>,
): Promise<Fiador> {
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(dados)) {
    if (v !== undefined) payload[k] = v;
  }

  const { data, error } = await supabase
    .from("fiadores")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("atualizarFiador:", error);
    throw new Error(error.message || "Erro ao atualizar fiador.");
  }
  return data as unknown as Fiador;
}
