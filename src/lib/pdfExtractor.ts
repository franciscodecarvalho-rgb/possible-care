export async function pdfToBase64Images(file: File): Promise<string[]> {
  const pdfjsLib = (window as Window & { pdfjsLib?: any }).pdfjsLib;

  if (!pdfjsLib) {
    throw new Error("PDF.js não foi carregado no navegador.");
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Não foi possível inicializar o canvas para renderizar o PDF.");
    }

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/png").split(",")[1]);
  }

  return images;
}

// REGRA CRÍTICA dos prompts: campo não encontrado = null (NUNCA 0).
// O motor de scoring diferencia `null` (dado ausente) de `0` (valor legítimo,
// ex.: isento de IR, sem dívidas). Instruir a IA a usar 0 para ausentes
// contamina o cálculo — ver src/lib/creditScoring.ts (isMissing).

const MISSING_RULE = `REGRA OBRIGATÓRIA: se um campo NÃO estiver explicitamente presente no documento, use null (não use 0, não use "", não estime). Use 0 SOMENTE quando o documento mostrar literalmente o valor zero. Para booleanos, use null quando não houver informação.`;

export const IRPF_PROMPT = `Analise esta Declaração de IRPF brasileira. Extraia TODOS os dados e retorne EXCLUSIVAMENTE um JSON válido sem texto adicional: { "nome_completo": null, "cpf": null, "data_nascimento": null, "ocupacao": null, "rendimentos_tributaveis_pj": null, "fontes_pagadoras": [{"nome": null, "cnpj": null, "valor_recebido": null}], "rendimentos_isentos_total": null, "dividendos_recebidos": null, "empresas_dividendos": [{"nome": null, "cnpj": null, "valor": null}], "rendimentos_tributacao_exclusiva": null, "total_deducoes": null, "contribuicao_previdenciaria": null, "despesas_medicas": null, "imposto_retido_fonte": null, "imposto_devido_total": null, "imposto_a_pagar": null, "imposto_a_restituir": null, "aliquota_efetiva_percentual": null, "bens_direitos_total_atual": null, "bens_direitos_total_anterior": null, "bens_lista": [{"descricao": null, "valor_anterior": null, "valor_atual": null}], "possui_imovel": null, "possui_veiculo": null, "dividas_onus_total_atual": null, "renda_total_anual": null, "numero_fontes_renda": null, "multiplas_fontes": null }. ${MISSING_RULE}`;

export const PJ_BALANCO_PROMPT = `Analise estes balanços patrimoniais de empresa brasileira. Extraia por ANO e retorne EXCLUSIVAMENTE um JSON válido sem texto adicional: { "razao_social": null, "cnpj": null, "balancos": [{ "ano_exercicio": null, "ativo_total": null, "ativo_circulante": null, "passivo_circulante": null, "passivo_nao_circulante": null, "patrimonio_liquido": null, "receita_bruta": null, "lucro_liquido": null, "estoque": null }], "possui_imovel_proprio": null, "tempo_mercado_anos": null }. Ordene o array "balancos" do exercício mais antigo para o mais recente. ${MISSING_RULE}`;

export const PJ_FATURAMENTO_PROMPT = `Analise este relatório de faturamento dos últimos 12 meses de empresa brasileira. Retorne EXCLUSIVAMENTE um JSON válido sem texto adicional: { "razao_social": null, "cnpj": null, "faturamento_mensal": [{ "mes_ano": null, "valor": null }], "faturamento_total_12_meses": null, "media_mensal": null, "coeficiente_variacao_percentual": null }. Em "mes_ano" use o formato MM/AAAA e ordene do mês mais antigo para o mais recente. ${MISSING_RULE}`;
