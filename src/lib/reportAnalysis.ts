import type { ScoringResult, ScoreBreakdown } from "./creditScoring";

// As frases são escolhidas pelo APROVEITAMENTO relativo (pontos/peso máximo),
// não por pontos absolutos — assim a narrativa continua coerente quando o
// admin altera os pesos dos critérios em /configuracoes.
const ratio = (b: ScoreBreakdown | undefined): number | null =>
  b && b.maxPoints > 0 ? b.points / b.maxPoints : null;

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
    (l) => /ACIMA|NEGATIV|INCOMPATÍVEL|INSIGNIFICANTE|Ausência|CRÍTICO|inconsistentes|ELEVADO|ABAIXO|INSUFICIENTE|IRREGULAR|queda|não informad/i.test(l)
  );
  if (!hasCaveat) {
    lines.push("Recomenda-se verificação complementar de documentação e consulta a bureaus de crédito antes da decisão final.");
  }

  return lines.slice(0, 8);
}

function generatePFAnalysis(lines: string[], b: Record<string, ScoreBreakdown>) {
  const comp = ratio(b["Comprometimento de Renda"]);
  const evol = ratio(b["Evolução Patrimonial"]);
  const patRenda = ratio(b["Patrimônio vs Renda"]);
  const endiv = ratio(b["Endividamento"]);
  const bens = ratio(b["Posse de Bens Reais"]);
  const trib = ratio(b["Coerência Tributária"]);

  if (comp !== null) {
    if (comp >= 1) lines.push("Comprometimento de renda dentro de parâmetros seguros, indicando capacidade de pagamento adequada.");
    else if (comp >= 0.7) lines.push("Comprometimento de renda em nível MODERADO, exigindo atenção ao fluxo de caixa mensal.");
    else if (comp >= 0.3) lines.push("Comprometimento de renda ELEVADO, próximo ao limite prudencial.");
    else lines.push("Comprometimento de renda ACIMA do limite prudencial, representando risco significativo de inadimplência.");
  }

  if (evol !== null) {
    if (evol >= 0.75) lines.push("Evolução patrimonial consistente, demonstrando disciplina financeira e capacidade de acumulação.");
    else if (evol >= 0.4) lines.push("Evolução patrimonial MODERADA em relação à renda declarada.");
    else if (evol >= 0.1) lines.push("Evolução patrimonial INSIGNIFICANTE em relação à renda declarada, sugerindo baixa capacidade de poupança.");
    else lines.push("Evolução patrimonial NEGATIVA ou não informada, indicando consumo, desvalorização de ativos ou lacuna documental.");
  }

  if (patRenda !== null) {
    if (patRenda >= 0.67) lines.push("Patrimônio acumulado compatível com o nível de renda, reforçando a solidez financeira do solicitante.");
    else if (patRenda >= 0.33) lines.push("Patrimônio acumulado em nível INTERMEDIÁRIO em relação à renda declarada.");
    else lines.push("Patrimônio acumulado INCOMPATÍVEL com o nível de renda, indicando possível fragilidade financeira.");
  }

  if (bens === 0) {
    lines.push("Ausência de bens reais (imóveis/veículos) REDUZ a capacidade de ofertar garantias reais para a operação.");
  }

  if (endiv === 0) {
    lines.push("Nível de endividamento CRÍTICO em relação ao patrimônio declarado, ou dados de dívidas não informados.");
  }

  if (trib === 0) {
    lines.push("Dados tributários inconsistentes ou não informados, prejudicando a avaliação de coerência fiscal.");
  }
}

function generatePJAnalysis(lines: string[], b: Record<string, ScoreBreakdown>) {
  const liq = ratio(b["Liquidez Corrente"]);
  const fat = ratio(b["Evolução Faturamento"]);
  const margem = ratio(b["Margem de Lucro"]);
  const endiv = ratio(b["Endividamento"]);
  const comp = ratio(b["Comprometimento Crédito/PL"]);
  const reg = ratio(b["Regularidade Faturamento"]);
  const pl = ratio(b["PL Positivo/Crescente"]);

  if (liq !== null) {
    if (liq >= 0.8) lines.push("Liquidez corrente adequada, indicando capacidade de honrar obrigações de curto prazo.");
    else if (liq >= 0.45) lines.push("Liquidez corrente no limite mínimo aceitável, exigindo monitoramento do capital de giro.");
    else lines.push("Liquidez corrente ABAIXO do mínimo prudencial (ou não informada), indicando risco de INSUFICIÊNCIA de caixa.");
  }

  if (fat !== null) {
    if (fat >= 0.65) lines.push("Faturamento em trajetória de crescimento, demonstrando dinamismo comercial.");
    else if (fat >= 0.4) lines.push("Faturamento estável, sem sinais de expansão significativa.");
    else lines.push("Faturamento em queda, sinalizando perda de mercado ou retração da atividade.");
  }

  if (margem !== null) {
    if (margem >= 0.73) lines.push("Margem de lucro líquido saudável, compatível com geração de caixa para amortização do crédito.");
    else if (margem >= 0.4) lines.push("Margem de lucro MODERADA, limitando a capacidade de absorção de custos financeiros adicionais.");
    else if (margem >= 0.13) lines.push("Margem de lucro INSUFICIENTE para absorver encargos financeiros relevantes.");
    else lines.push("Margem de lucro NEGATIVA ou não informada, indicando prejuízo operacional ou lacuna documental.");
  }

  if (endiv !== null && endiv <= 0.3) {
    lines.push("Nível de endividamento ELEVADO em relação ao ativo total, comprometendo a estrutura de capital.");
  }

  if (comp !== null && comp <= 0.2) {
    lines.push("Crédito solicitado representa parcela EXCESSIVA do patrimônio líquido, elevando o risco da operação.");
  }

  if (reg !== null && reg <= 0.3) {
    lines.push("Faturamento IRREGULAR ao longo dos 12 meses, indicando sazonalidade ou instabilidade operacional.");
  }

  if (pl === 0) {
    lines.push("Patrimônio líquido NEGATIVO ou não informado, configurando situação de risco patrimonial.");
  }
}
