import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um auditor de políticas de crédito. Sua tarefa: comparar uma política em texto natural com a configuração numérica vigente de um sistema de scoring e propor ajustes específicos para que a configuração reflita a política. Cada sugestão deve ser INDEPENDENTE — aplicar uma não deve depender de aplicar outra.

Regras:
- Retorne EXCLUSIVAMENTE um JSON ARRAY (sem markdown, sem texto adicional, sem objeto envoltório).
- Cada item do array deve ter exatamente os campos: "campo" (string com o path no JSON da config, ex: "corteFiadorPf" ou "decisionBands[0].min" ou "regrasLimite[1].percentual"), "valor_atual" (valor atualmente vigente — número, string ou null), "valor_sugerido" (novo valor), "motivo" (frase curta extraída da política).
- Se a política não exigir nenhuma mudança, retorne [].
- Não invente campos que não existam na configuração atual.
- Não sugira mudanças cosméticas (descrição, label) — só parâmetros numéricos ou booleanos que afetem o cálculo de score, faixas de decisão, cortes de fiador, validade ou regras de limite.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { politica, config } = await req.json();

    if (!politica || typeof politica !== "string" || !config || typeof config !== "object") {
      return new Response(
        JSON.stringify({ error: "Campos 'politica' (string) e 'config' (objeto) são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userContent = `Política nova (texto natural):
"""
${politica}
"""

Configuração atual (JSON):
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

Retorne SOMENTE o array JSON de sugestões, conforme as regras do sistema.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0,
        top_p: 0,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações do workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar sugestões." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    let sugestoes: unknown;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      sugestoes = JSON.parse(cleaned);
    } catch {
      console.error("IA não retornou JSON válido:", rawText);
      return new Response(
        JSON.stringify({
          error: "IA não retornou JSON válido.",
          raw_text: String(rawText).slice(0, 500),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(sugestoes)) {
      return new Response(
        JSON.stringify({ error: "Resposta da IA não é um array." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ sugestoes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sugerir-ajustes-config error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
