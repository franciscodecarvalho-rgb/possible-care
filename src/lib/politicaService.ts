import { supabase } from "@/integrations/supabase/client";

export interface PoliticaCredito {
  id: string;
  conteudo: string;
  versao: number;
  ativa: boolean;
  criada_por: string | null;
  criada_em: string;
}

export type SugestaoStatus = "pendente" | "aplicada_total" | "aplicada_parcial" | "descartada";

export interface SugestaoItem {
  campo: string;
  valor_atual: unknown;
  valor_sugerido: unknown;
  motivo: string;
}

export interface SugestoesConfig {
  id: string;
  politica_id: string | null;
  sugestoes: SugestaoItem[];
  status: SugestaoStatus;
  criada_em: string;
  resolvida_em: string | null;
  resolvida_por: string | null;
}

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export async function obterPoliticaAtiva(): Promise<PoliticaCredito | null> {
  const { data, error } = await supabase
    .from("politicas_credito")
    .select("*")
    .eq("ativa", true)
    .maybeSingle();

  if (error) {
    console.error("obterPoliticaAtiva:", error);
    throw new Error(error.message || "Erro ao carregar política.");
  }
  return (data as PoliticaCredito | null) ?? null;
}

export async function listarVersoes(): Promise<PoliticaCredito[]> {
  const { data, error } = await supabase
    .from("politicas_credito")
    .select("*")
    .order("versao", { ascending: false });

  if (error) {
    console.error("listarVersoes:", error);
    throw new Error(error.message || "Erro ao listar versões da política.");
  }
  return (data ?? []) as PoliticaCredito[];
}

export async function salvarNovaVersao(conteudo: string): Promise<PoliticaCredito> {
  const uid = await getUserId();
  if (!uid) throw new Error("Usuário não autenticado");

  const atual = await obterPoliticaAtiva();
  const proximaVersao = (atual?.versao ?? 0) + 1;

  if (atual) {
    const { error: errDeact } = await supabase
      .from("politicas_credito")
      .update({ ativa: false })
      .eq("id", atual.id);
    if (errDeact) {
      console.error("salvarNovaVersao deact:", errDeact);
      throw new Error(errDeact.message || "Erro ao desativar versão anterior.");
    }
  }

  const { data, error } = await supabase
    .from("politicas_credito")
    .insert({
      conteudo,
      versao: proximaVersao,
      ativa: true,
      criada_por: uid,
    })
    .select("*")
    .single();

  if (error) {
    console.error("salvarNovaVersao insert:", error);
    throw new Error(error.message || "Erro ao salvar nova versão.");
  }
  return data as PoliticaCredito;
}

export async function obterSugestoesPendentes(): Promise<SugestoesConfig[]> {
  const { data, error } = await supabase
    .from("sugestoes_config")
    .select("*")
    .eq("status", "pendente")
    .order("criada_em", { ascending: false });

  if (error) {
    console.error("obterSugestoesPendentes:", error);
    throw new Error(error.message || "Erro ao carregar sugestões.");
  }
  return ((data ?? []) as unknown) as SugestoesConfig[];
}

export async function criarSugestoes(
  politicaId: string,
  sugestoes: SugestaoItem[],
): Promise<SugestoesConfig> {
  const { data, error } = await supabase
    .from("sugestoes_config")
    .insert({
      politica_id: politicaId,
      sugestoes: sugestoes as any,
      status: "pendente",
    })
    .select("*")
    .single();
  if (error) {
    console.error("criarSugestoes:", error);
    throw new Error(error.message || "Erro ao registrar sugestões.");
  }
  return data as unknown as SugestoesConfig;
}

export async function marcarSugestoesResolvidas(
  id: string,
  status: SugestaoStatus,
): Promise<void> {
  const uid = await getUserId();
  const { error } = await supabase
    .from("sugestoes_config")
    .update({
      status,
      resolvida_em: new Date().toISOString(),
      resolvida_por: uid,
    })
    .eq("id", id);

  if (error) {
    console.error("marcarSugestoesResolvidas:", error);
    throw new Error(error.message || "Erro ao atualizar status das sugestões.");
  }
}

export async function descartarSugestoes(id: string): Promise<void> {
  await marcarSugestoesResolvidas(id, "descartada");
}
