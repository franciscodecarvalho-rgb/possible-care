import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUREAU_SCHEMA = `{
  "nome_consultado": null,
  "documento_consultado": null,
  "data_nascimento_fundacao": null,
  "data_consulta": null,
  "score_valor": null,
  "score_classificacao": null,
  "probabilidade_inadimplencia": null,
  "pefin": {
    "quantidade": null,
    "valor_total": null,
    "lista": [{ "credor": null, "valor": null, "data": null, "status": null }]
  },
  "refin": {
    "quantidade": null,
    "valor_total": null,
    "lista": [{ "credor": null, "valor": null, "data": null }]
  },
  "protestos": {
    "quantidade": null,
    "valor_total": null,
    "lista": [{ "cartorio": null, "valor": null, "data": null, "cidade": null, "uf": null }]
  },
  "acoes_judiciais": {
    "quantidade": null,
    "valor_total": null,
    "lista": [{ "tribunal": null, "numero": null, "tipo": null, "data": null }]
  },
  "ccf_cheques_sem_fundo": { "quantidade": null, "valor_total": null },
  "consultas_recentes": {
    "ultimos_30_dias": null,
    "ultimos_90_dias": null,
    "ultimos_180_dias": null
  },
  "participacoes_societarias": [],
  "socios": [],
  "anotacoes_internas": [],
  "enderecos_conhecidos": [],
  "telefones_conhecidos": [],
  "indicadores_setoriais": null,
  "outros_dados": null
}`;

const BUREAU_PROMPT = `Você está analisando um relatório de bureau de crédito brasileiro (Serasa ou Boa Vista). Extraia TODAS as informações disponíveis no documento e estruture conforme o JSON abaixo. Regras estritas:
- Campos que não aparecem no documento devem ficar null (não invente, não estime, não infira).
- Quando o documento listar vários itens (ex: várias dívidas Pefin, vários protestos), retorne todos os itens encontrados na "lista" correspondente.
- Listas vazias devem ser [] quando o documento explicitamente declara que não há ocorrências; null quando o campo simplesmente não consta.
- Valores monetários: número decimal sem símbolo (ex: 1234.56), não string.
- Datas: formato ISO YYYY-MM-DD quando possível; se vier em outro formato, mantenha como string.
- Seja literal, não tire conclusões nem interprete os números.
- Use "outros_dados" como catch-all em texto livre para informações relevantes que não couberam em campos específicos.
- Retorne EXCLUSIVAMENTE JSON válido, sem markdown, sem texto adicional, mantendo exatamente os mesmos nomes de campos do schema.

Schema:
${BUREAU_SCHEMA}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma imagem fornecida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const content: any[] = [];
    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${img}` },
      });
    }
    content.push({ type: "text", text: BUREAU_PROMPT });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um extrator determinístico de relatórios de bureau de crédito brasileiros (Serasa, Boa Vista). Extraia somente valores explicitamente presentes no documento; não estime, não infira. Use null para campos ausentes. Retorne EXCLUSIVAMENTE JSON válido sem markdown.",
          },
          { role: "user", content },
        ],
        temperature: 0,
        top_p: 0,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações do workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erro ao processar relatório de bureau." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw_text: rawText };
    }

    return new Response(JSON.stringify({ extracted: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-bureau error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
