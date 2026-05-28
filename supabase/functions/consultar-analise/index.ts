import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256Hex = async (input: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
};

const extractApiKey = (req: Request): string | null => {
  const xkey = req.headers.get("x-api-key");
  if (xkey && xkey.trim().length > 0) return xkey.trim();
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
};

const extractProtocolo = (url: URL): string | null => {
  // Match /consultar-analise/{protocolo} or query param ?protocolo=
  const fromQuery = url.searchParams.get("protocolo");
  if (fromQuery) return fromQuery.trim();
  const parts = url.pathname.split("/").filter((p) => p.length > 0);
  const idx = parts.findIndex((p) => p === "consultar-analise");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].trim();
  // Fallback: last segment if path doesn't include function name (Supabase rewrites)
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (last !== "consultar-analise") return last.trim();
  }
  return null;
};

const ipFromRequest = (req: Request): string | null => {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
};

const mapearStatus = (
  decision: string | null,
  insufficientData: boolean | null,
  validadeISO: string | null,
): { status: string; expirou: boolean } => {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const expirou = Boolean(
    validadeISO && new Date(validadeISO + "T00:00:00Z").getTime() < hoje.getTime(),
  );
  if (insufficientData) return { status: "pendente", expirou };
  if (!decision) return { status: "pendente", expirou };
  const upper = decision.toUpperCase();
  if (upper.includes("APROVADO")) return { status: "aprovado", expirou };
  if (upper.includes("REPROVADO")) return { status: "reprovado", expirou };
  if (upper.includes("INCONCLUSIVA")) return { status: "pendente", expirou };
  return { status: "pendente", expirou };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Servidor mal configurado." }, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const url = new URL(req.url);
  const protocolo = extractProtocolo(url);
  const ip = ipFromRequest(req);

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return json(
      {
        error: "API key ausente. Envie via header Authorization: Bearer <key> ou x-api-key: <key>.",
      },
      401,
    );
  }

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow, error: keyErr } = await admin
    .from("api_keys")
    .select("id, ativa")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !keyRow || !keyRow.ativa) {
    // Log mesmo sem key válida (api_key_id null)
    await admin.from("consultas_api").insert({
      api_key_id: null,
      protocolo: protocolo || "—",
      analise_id: null,
      status_http: 401,
      resposta_json: { error: "API key inválida ou revogada." },
      ip_origem: ip,
    });
    return json({ error: "API key inválida ou revogada." }, 401);
  }

  // Atualiza ultima_uso (best-effort, não bloqueia)
  await admin
    .from("api_keys")
    .update({ ultima_uso: new Date().toISOString() })
    .eq("id", keyRow.id);

  if (!protocolo) {
    const body = { error: "Protocolo ausente. Use /consultar-analise/{protocolo}." };
    await admin.from("consultas_api").insert({
      api_key_id: keyRow.id,
      protocolo: "—",
      analise_id: null,
      status_http: 400,
      resposta_json: body,
      ip_origem: ip,
    });
    return json(body, 400);
  }

  const { data: analise, error: anaErr } = await admin
    .from("analises")
    .select(
      "id, protocolo, decision, insufficient_data, validade_analise, limite_aprovado, parcelas_aprovadas, limite_sugerido, parcelas_sugeridas, data, cliente_id, justificativa_ajuste, extracted_data, form_data, clientes:cliente_id(documento)",
    )
    .eq("protocolo", protocolo)
    .maybeSingle();

  if (anaErr) {
    console.error("erro ao buscar analise:", anaErr);
    const body = { error: "Erro ao consultar análise." };
    await admin.from("consultas_api").insert({
      api_key_id: keyRow.id,
      protocolo,
      analise_id: null,
      status_http: 500,
      resposta_json: body,
      ip_origem: ip,
    });
    return json(body, 500);
  }

  if (!analise) {
    const body = { error: "Análise não encontrada." };
    await admin.from("consultas_api").insert({
      api_key_id: keyRow.id,
      protocolo,
      analise_id: null,
      status_http: 404,
      resposta_json: body,
      ip_origem: ip,
    });
    return json(body, 404);
  }

  const { status: statusMapped, expirou } = mapearStatus(
    (analise as any).decision,
    (analise as any).insufficient_data,
    (analise as any).validade_analise,
  );

  const limiteFinal = expirou ? 0 : (analise as any).limite_aprovado ?? (analise as any).limite_sugerido ?? 0;
  const parcelasFinal = expirou
    ? 0
    : (analise as any).parcelas_aprovadas ?? (analise as any).parcelas_sugeridas ?? 0;
  const status = expirou ? "expirado" : statusMapped;

  const clienteDoc =
    (analise as any).clientes?.documento ??
    (analise as any).extracted_data?.cpf ??
    (analise as any).extracted_data?.cnpj ??
    null;

  const body = {
    numero_analise: (analise as any).protocolo,
    status,
    limite_aprovado: typeof limiteFinal === "number" ? limiteFinal : Number(limiteFinal) || 0,
    parcelas_maximas: typeof parcelasFinal === "number" ? parcelasFinal : Number(parcelasFinal) || 0,
    prazo_maximo_dias:
      (typeof parcelasFinal === "number" ? parcelasFinal : Number(parcelasFinal) || 0) * 30,
    validade_analise: (analise as any).validade_analise ?? null,
    observacoes: (analise as any).justificativa_ajuste ?? "",
    cliente_consultado: clienteDoc,
  };

  await admin.from("consultas_api").insert({
    api_key_id: keyRow.id,
    protocolo,
    analise_id: (analise as any).id,
    status_http: 200,
    resposta_json: body,
    ip_origem: ip,
  });

  return json(body, 200);
});
