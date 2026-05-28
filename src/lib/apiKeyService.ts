import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  nome: string;
  prefixo: string;
  ativa: boolean;
  criada_em: string;
  criada_por: string | null;
  ultima_uso: string | null;
  revogada_em: string | null;
}

export interface ConsultaApi {
  id: string;
  api_key_id: string | null;
  protocolo: string;
  analise_id: string | null;
  status_http: number;
  resposta_json: Record<string, any> | null;
  ip_origem: string | null;
  consultada_em: string;
}

export interface FiltrosConsultas {
  apiKeyId?: string;
  statusHttp?: number;
  de?: string;
  ate?: string;
  pageSize?: number;
  offset?: number;
}

export interface ChaveGerada {
  id: string;
  apiKey: string;
  prefixo: string;
}

const PREFIX = "pck_live_";
const RANDOM_LENGTH = 32;

const randomToken = (size = RANDOM_LENGTH): string => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, size);
};

const sha256Hex = async (input: string): Promise<string> => {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
};

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export async function gerarChave(nome: string): Promise<ChaveGerada> {
  if (!nome.trim()) throw new Error("Informe um nome para a chave.");
  const uid = await getUserId();
  if (!uid) throw new Error("Usuário não autenticado.");

  const tokenRaw = randomToken();
  const apiKey = `${PREFIX}${tokenRaw}`;
  const prefixo = apiKey.slice(0, 12);
  const keyHash = await sha256Hex(apiKey);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      nome: nome.trim(),
      key_hash: keyHash,
      prefixo,
      criada_por: uid,
    })
    .select("id")
    .single();

  if (error) {
    console.error("gerarChave:", error);
    throw new Error(error.message || "Erro ao gerar chave.");
  }
  return { id: data.id as string, apiKey, prefixo };
}

export async function listarChaves(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("criada_em", { ascending: false });
  if (error) {
    console.error("listarChaves:", error);
    throw new Error(error.message || "Erro ao listar chaves.");
  }
  return (data ?? []) as ApiKey[];
}

export async function revogarChave(id: string): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .update({ ativa: false, revogada_em: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("revogarChave:", error);
    throw new Error(error.message || "Erro ao revogar chave.");
  }
}

export async function listarConsultas(filtros: FiltrosConsultas = {}): Promise<ConsultaApi[]> {
  const pageSize = Math.max(1, Math.min(filtros.pageSize ?? 50, 200));
  const offset = Math.max(0, filtros.offset ?? 0);

  let query = supabase
    .from("consultas_api")
    .select("*")
    .order("consultada_em", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filtros.apiKeyId) query = query.eq("api_key_id", filtros.apiKeyId);
  if (typeof filtros.statusHttp === "number") query = query.eq("status_http", filtros.statusHttp);
  if (filtros.de) query = query.gte("consultada_em", filtros.de);
  if (filtros.ate) query = query.lte("consultada_em", filtros.ate);

  const { data, error } = await query;
  if (error) {
    console.error("listarConsultas:", error);
    throw new Error(error.message || "Erro ao listar consultas.");
  }
  return ((data ?? []) as unknown) as ConsultaApi[];
}
