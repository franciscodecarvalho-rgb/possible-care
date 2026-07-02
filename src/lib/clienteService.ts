import { supabase } from "@/integrations/supabase/client";

export const STATUS_CLIENTE = [
  { value: "prospect", label: "Prospect", cor: "bg-gray-500" },
  { value: "em_analise", label: "Em análise", cor: "bg-blue-500" },
  { value: "aprovado", label: "Aprovado", cor: "bg-green-600" },
  { value: "aprovado_ressalvas", label: "Aprovado com ressalvas", cor: "bg-yellow-500" },
  { value: "reprovado", label: "Reprovado", cor: "bg-red-600" },
  { value: "contrato_emitido", label: "Contrato emitido", cor: "bg-cyan-600" },
  { value: "em_pagamento", label: "Em pagamento", cor: "bg-indigo-600" },
  { value: "quitado", label: "Quitado", cor: "bg-emerald-600" },
  { value: "inadimplente", label: "Inadimplente", cor: "bg-rose-600" },
  { value: "renegociado", label: "Renegociado", cor: "bg-amber-600" },
] as const;

export type StatusCliente = (typeof STATUS_CLIENTE)[number]["value"];

export const getStatusInfo = (value: string) =>
  STATUS_CLIENTE.find((s) => s.value === value) ?? STATUS_CLIENTE[0];

export type TipoCliente = "pf" | "pj";

export interface Cliente {
  id: string;
  tipo: TipoCliente;
  nome: string;
  documento: string;
  email: string | null;
  telefone: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  observacoes: string | null;
  data_nascimento: string | null;
  rg: string | null;
  ocupacao: string | null;
  nome_fantasia: string | null;
  data_fundacao: string | null;
  porte: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ClienteInput = Omit<Cliente, "id" | "created_by" | "created_at" | "updated_at">;

export interface ClienteFiltros {
  busca?: string;
  status?: string;
  tipo?: TipoCliente | "todos";
}

const isDuplicate = (err: any) =>
  err?.code === "23505" || /duplicate key|unique/i.test(err?.message ?? "");

export async function listarClientes(filtros: ClienteFiltros = {}): Promise<Cliente[]> {
  let query = supabase.from("clientes").select("*").order("nome", { ascending: true });

  if (filtros.tipo && filtros.tipo !== "todos") query = query.eq("tipo", filtros.tipo);
  if (filtros.status && filtros.status !== "todos") query = query.eq("status", filtros.status);
  if (filtros.busca && filtros.busca.trim()) {
    const term = filtros.busca.trim().replace(/[%,]/g, "");
    query = query.or(`nome.ilike.%${term}%,documento.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listarClientes:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as Cliente[];
}

export async function obterCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("obterCliente:", error);
    throw new Error(error.message);
  }
  return data as Cliente | null;
}

export async function criarCliente(dados: ClienteInput): Promise<Cliente> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...dados, created_by: uid })
    .select("*")
    .single();

  if (error) {
    console.error("criarCliente:", error);
    if (isDuplicate(error)) throw new Error("Já existe um cliente com esse documento");
    throw new Error(error.message);
  }
  return data as Cliente;
}

export async function atualizarCliente(id: string, dados: Partial<ClienteInput>): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("atualizarCliente:", error);
    if (isDuplicate(error)) throw new Error("Já existe um cliente com esse documento");
    throw new Error(error.message);
  }
  return data as Cliente;
}

export async function listarAnalisesDoCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("analises")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false });

  if (error) {
    console.error("listarAnalisesDoCliente:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function contarClientesPorStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("clientes").select("status");
  if (error) {
    console.error("contarClientesPorStatus:", error);
    throw new Error(error.message);
  }
  const counts: Record<string, number> = {};
  for (const s of STATUS_CLIENTE) counts[s.value] = 0;
  for (const row of data ?? []) {
    const k = (row as any).status as string;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// ===== Máscaras =====
const onlyDigits = (v: string) => v.replace(/\D/g, "");

export const maskCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const maskCNPJ = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

export const maskDocumento = (v: string, tipo: TipoCliente) =>
  tipo === "pf" ? maskCPF(v) : maskCNPJ(v);

export const maskCEP = (v: string) => {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
};

export const maskTelefone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const validaCPF = (cpf: string): boolean => {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const pos of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += parseInt(d[i]) * (pos + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== parseInt(d[pos])) return false;
  }
  return true;
};

const validaCNPJ = (cnpj: string): boolean => {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number): number => {
    const pesos = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < len; i++) soma += parseInt(d[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
};

export const validarDocumento = (doc: string, tipo: TipoCliente) =>
  tipo === "pf" ? validaCPF(doc) : validaCNPJ(doc);

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];
