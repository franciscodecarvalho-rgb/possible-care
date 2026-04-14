import type { ScoringResult } from "./creditScoring";

export function generateAnalysis(result: ScoringResult): string[] {
  const lines: string[] = [];
  const b = Object.fromEntries(result.breakdown.map((x) => [x.category, x]));

  const comp = b["Comprometimento de Renda"];
  const evol = b["Evolução Patrimonial"];
  const patRenda = b["Patrimônio vs Renda"];
  const endiv = b["Endividamento"];
  const estab = b["Estabilidade de Renda"];
  const bens = b["Posse de Bens Reais"];
  const trib = b["Coerência Tributária"];

  // Positive / negative phrases
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

  // Ensure at least one caveat
  if (lines.every((l) => !l.includes("ACIMA") && !l.includes("NEGATIV") && !l.includes("INCOMPATÍVEL") && !l.includes("INSIGNIFICANTE") && !l.includes("Ausência") && !l.includes("CRÍTICO") && !l.includes("inconsistentes") && !l.includes("ELEVADO"))) {
    lines.push("Recomenda-se verificação complementar de documentação e consulta a bureaus de crédito antes da decisão final.");
  }

  return lines.slice(0, 8);
}
