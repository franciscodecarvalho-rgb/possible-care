import type { ScoringResult } from "./creditScoring";

export function generateAnalysis(result: ScoringResult): string[] {
  const lines: string[] = [];
  const b = Object.fromEntries(result.breakdown.map((x) => [x.category, x]));

  if (result.tipo === "pf") {
    generatePFAnalysis(lines, b);
  } else {
    generatePJAnalysis(lines, b);
  }

  // Ensure at least one caveat
  const hasCaveat = lines.some(
    (l) => /ACIMA|NEGATIV|INCOMPATÍVEL|INSIGNIFICANTE|Ausência|CRÍTICO|inconsistentes|ELEVADO|ABAIXO|INSUFICIENTE|IRREGULAR|queda/i.test(l)
  );
  if (!hasCaveat) {
    lines.push("Recomenda-se verificação complementar de documentação e consulta a bureaus de crédito antes da decisão final.");
  }

  return lines.slice(0, 8);
}

function generatePFAnalysis(lines: string[], b: Record<string, any>) {
  const comp = b["Comprometimento de Renda"];
  const evol = b["Evolução Patrimonial"];
  const patRenda = b["Patrimônio vs Renda"];
  const endiv = b["Endividamento"];
  const bens = b["Posse de Bens Reais"];
  const trib = b["Coerência Tributária"];

  if (comp) {
    if (comp.points >= 250) lines.push("Comprometimento de renda dentro de parâmetros seguros, indicando capacidade de pagamento adequada.");
    else if (comp.points >= 180) lines.push("Comprometimento de renda em nível MODERADO, exigindo atenção ao fluxo de caixa mensal.");
    else if (comp.points >= 90) lines.push("Comprometimento de renda ELEVADO, próximo ao limite prudencial de 35%.");
    else lines.push("Comprometimento de renda ACIMA do limite prudencial, representando risco significativo de inadimplência.");
  }

  if (evol) {
    if (evol.points >= 150) lines.push("Evolução patrimonial consistente, demonstrando disciplina financeira e capacidade de acumulação.");
    else if (evol.points >= 80) lines.push("Evolução patrimonial MODERADA em relação à renda declarada.");
    else if (evol.points >= 20) lines.push("Evolução patrimonial INSIGNIFICANTE em relação à renda declarada, sugerindo baixa capacidade de poupança.");
    else lines.push("Evolução patrimonial NEGATIVA, indicando consumo ou desvalorização de ativos no período.");
  }

  if (patRenda) {
    if (patRenda.points >= 100) lines.push("Patrimônio acumulado compatível com o nível de renda, reforçando a solidez financeira do solicitante.");
    else if (patRenda.points >= 50) lines.push("Patrimônio acumulado em nível INTERMEDIÁRIO em relação à renda declarada.");
    else lines.push("Patrimônio acumulado INCOMPATÍVEL com o nível de renda, indicando possível fragilidade financeira.");
  }

  if (bens && bens.points === 0) {
    lines.push("Ausência de bens reais (imóveis/veículos) REDUZ a capacidade de ofertar garantias reais para a operação.");
  }

  if (endiv && endiv.points === 0) {
    lines.push("Nível de endividamento CRÍTICO em relação ao patrimônio declarado.");
  }

  if (trib && trib.points === 0) {
    lines.push("Dados tributários inconsistentes ou não informados, prejudicando a avaliação de coerência fiscal.");
  }
}

function generatePJAnalysis(lines: string[], b: Record<string, any>) {
  const liq = b["Liquidez Corrente"];
  const fat = b["Evolução Faturamento"];
  const margem = b["Margem de Lucro"];
  const endiv = b["Endividamento"];
  const comp = b["Comprometimento Crédito/PL"];
  const reg = b["Regularidade Faturamento"];
  const pl = b["PL Positivo/Crescente"];

  if (liq) {
    if (liq.points >= 120) lines.push("Liquidez corrente adequada, indicando capacidade de honrar obrigações de curto prazo.");
    else if (liq.points >= 70) lines.push("Liquidez corrente no limite mínimo aceitável, exigindo monitoramento do capital de giro.");
    else lines.push("Liquidez corrente ABAIXO do mínimo prudencial, indicando risco de INSUFICIÊNCIA de caixa.");
  }

  if (fat) {
    if (fat.points >= 100) lines.push("Faturamento em trajetória de crescimento, demonstrando dinamismo comercial.");
    else if (fat.points >= 60) lines.push("Faturamento estável, sem sinais de expansão significativa.");
    else lines.push("Faturamento em queda, sinalizando perda de mercado ou retração da atividade.");
  }

  if (margem) {
    if (margem.points >= 110) lines.push("Margem de lucro líquido saudável, compatível com geração de caixa para amortização do crédito.");
    else if (margem.points >= 60) lines.push("Margem de lucro MODERADA, limitando a capacidade de absorção de custos financeiros adicionais.");
    else if (margem.points >= 20) lines.push("Margem de lucro INSUFICIENTE para absorver encargos financeiros relevantes.");
    else lines.push("Margem de lucro NEGATIVA, indicando prejuízo operacional e impossibilidade de servir nova dívida.");
  }

  if (endiv && endiv.points <= 40) {
    lines.push("Nível de endividamento ELEVADO em relação ao ativo total, comprometendo a estrutura de capital.");
  }

  if (comp && comp.points <= 20) {
    lines.push("Crédito solicitado representa parcela EXCESSIVA do patrimônio líquido, elevando o risco da operação.");
  }

  if (reg && reg.points <= 30) {
    lines.push("Faturamento IRREGULAR ao longo dos 12 meses, indicando sazonalidade ou instabilidade operacional.");
  }

  if (pl && pl.points === 0) {
    lines.push("Patrimônio líquido NEGATIVO, configurando situação de passivo a descoberto.");
  }
}
