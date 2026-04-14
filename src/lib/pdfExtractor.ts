import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function pdfToBase64Images(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/png").split(",")[1]);
  }

  return images;
}

export const IRPF_PROMPT = `Analise esta Declaração de IRPF brasileira. Extraia TODOS os dados e retorne EXCLUSIVAMENTE um JSON válido sem texto adicional: { "nome_completo": "", "cpf": "", "data_nascimento": "", "ocupacao": "", "rendimentos_tributaveis_pj": 0, "fontes_pagadoras": [{"nome": "", "cnpj": "", "valor_recebido": 0}], "rendimentos_isentos_total": 0, "dividendos_recebidos": 0, "empresas_dividendos": [{"nome": "", "cnpj": "", "valor": 0}], "rendimentos_tributacao_exclusiva": 0, "total_deducoes": 0, "contribuicao_previdenciaria": 0, "despesas_medicas": 0, "imposto_retido_fonte": 0, "imposto_devido_total": 0, "imposto_a_pagar": 0, "imposto_a_restituir": 0, "aliquota_efetiva_percentual": 0, "bens_direitos_total_atual": 0, "bens_direitos_total_anterior": 0, "bens_lista": [{"descricao": "", "valor_anterior": 0, "valor_atual": 0}], "possui_imovel": false, "possui_veiculo": false, "dividas_onus_total_atual": 0, "renda_total_anual": 0, "numero_fontes_renda": 0, "multiplas_fontes": false }. Se campo não encontrado: 0 para números, "NÃO INFORMADO" para textos.`;

export const COMPROVANTE_PROMPT = `Analise estes comprovantes de rendimento brasileiros. Extraia TODOS os dados e retorne EXCLUSIVAMENTE um JSON válido: { "nome_completo": "", "cpf": "", "comprovantes": [{"fonte_pagadora": "", "cnpj": "", "periodo": "", "rendimento_bruto": 0, "deducoes": 0, "imposto_retido": 0, "rendimento_liquido": 0}], "total_rendimento_bruto": 0, "total_deducoes": 0, "total_imposto_retido": 0, "renda_mensal_media": 0 }. Se campo não encontrado: 0 para números, "NÃO INFORMADO" para textos.`;

export const PJ_BALANCO_PROMPT = `Analise estes Balanços Patrimoniais brasileiros. Extraia TODOS os dados e retorne EXCLUSIVAMENTE um JSON válido: { "razao_social": "", "cnpj": "", "balancos": [{"periodo": "", "ativo_total": 0, "ativo_circulante": 0, "ativo_nao_circulante": 0, "passivo_total": 0, "passivo_circulante": 0, "passivo_nao_circulante": 0, "patrimonio_liquido": 0, "receita_liquida": 0, "lucro_bruto": 0, "lucro_liquido": 0}], "indicadores": {"liquidez_corrente": 0, "endividamento_percentual": 0, "margem_liquida_percentual": 0, "roe_percentual": 0} }. Se campo não encontrado: 0 para números, "NÃO INFORMADO" para textos.`;

export const PJ_FATURAMENTO_PROMPT = `Analise este relatório de faturamento dos últimos 12 meses. Extraia TODOS os dados e retorne EXCLUSIVAMENTE um JSON válido: { "razao_social": "", "cnpj": "", "faturamento_mensal": [{"mes": "", "valor": 0}], "faturamento_total_12m": 0, "media_mensal": 0, "maior_faturamento": {"mes": "", "valor": 0}, "menor_faturamento": {"mes": "", "valor": 0}, "tendencia": "crescente|estavel|decrescente" }. Se campo não encontrado: 0 para números, "NÃO INFORMADO" para textos.`;
