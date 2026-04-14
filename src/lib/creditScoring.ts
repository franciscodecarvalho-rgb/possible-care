// Credit Scoring Engine — Pessoa Física (IRPF) + Pessoa Jurídica (PJ)
// Reads configurable parameters from localStorage via scoringConfig

import { loadConfig, type ScoringConfig } from "./scoringConfig";

export interface ScoreBreakdown {
  category: string;
  maxPoints: number;
  points: number;
  detail: string;
}

export interface ScoringResult {
  score: number;
  breakdown: ScoreBreakdown[];
  decision: string;
  decisionColor: string;
  insufficientData: boolean;
  protocolo: string;
  data: string;
  tipo: string;
  pjDocType?: "balancos" | "faturamento";
  extractedData: Record<string, any>;
  formData: { valor: number; prazo: number; finalidade: string };
}

const generateProtocolo = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `AC-${code}`;
};

const num = (v: any): number => {
  if (v === null || v === undefined || v === "NÃO INFORMADO" || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const bool = (v: any): boolean | null => {
  if (v === true || v === "Sim" || v === "sim") return true;
  if (v === false || v === "Não" || v === "não" || v === "nao") return false;
  return null;
};

const isMissing = (v: any): boolean =>
  v === null || v === undefined || v === "" || v === "NÃO INFORMADO" || v === 0;

/** Price formula: PMT = PV * [i*(1+i)^n] / [(1+i)^n - 1] */
const calcParcela = (pv: number, taxaMensal: number, prazoMeses: number): number => {
  if (pv <= 0 || prazoMeses <= 0) return 0;
  const i = taxaMensal;
  const pow = Math.pow(1 + i, prazoMeses);
  return pv * (i * pow) / (pow - 1);
};

function getConfiguredWeight(config: ScoringConfig, type: "pfIrpf" | "pj", criterionId: string): number {
  const criteria = config[type];
  const found = criteria.find(c => c.id === criterionId);
  return found?.maxPoints ?? 0;
}

function makeDecision(score: number, insufficientData: boolean, config: ScoringConfig) {
  if (insufficientData) {
    return { decision: "ANÁLISE INCONCLUSIVA — DADOS INSUFICIENTES", decisionColor: "#6b7280" };
  }
  const sorted = [...config.decisionBands].sort((a, b) => b.min - a.min);
  for (const band of sorted) {
    if (score >= band.min && score <= band.max) {
      return { decision: band.label, decisionColor: band.color };
    }
  }
  const lowest = sorted[sorted.length - 1];
  return { decision: lowest?.label || "INDEFINIDO", decisionColor: lowest?.color || "#6b7280" };
}

function saveResult(result: ScoringResult) {
  const history = JSON.parse(localStorage.getItem("credit_history") || "[]");
  history.unshift(result);
  localStorage.setItem("credit_history", JSON.stringify(history));
}

// ===================== PF SCORING =====================
export function scorePF(
  extractedData: Record<string, any>,
  valor: number,
  prazo: number,
  finalidade: string
): ScoringResult {
  const config = loadConfig();
  const fp = config.financialParams;
  const breakdown: ScoreBreakdown[] = [];

  const keyFields = [
    "renda_total_anual", "bens_direitos_total_atual", "bens_direitos_total_anterior",
    "dividas_onus_total_atual", "possui_imovel", "possui_veiculo",
    "aliquota_efetiva_percentual", "imposto_devido_total",
  ];
  const missingCount = keyFields.filter((k) => isMissing(extractedData[k])).length;
  const insufficientData = missingCount > keyFields.length * (fp.percentualMinimoExtracoes / 100);

  const rendaAnual = num(extractedData.renda_total_anual);
  const rendaMensal = rendaAnual / 12;
  const bensAtual = num(extractedData.bens_direitos_total_atual);
  const bensAnterior = num(extractedData.bens_direitos_total_anterior);
  const dividasTotal = num(extractedData.dividas_onus_total_atual);
  const possuiImovel = bool(extractedData.possui_imovel);
  const possuiVeiculo = bool(extractedData.possui_veiculo);
  const aliquota = num(extractedData.aliquota_efetiva_percentual);
  const impostoDevido = num(extractedData.imposto_devido_total);
  const multiplasFontes = bool(extractedData.multiplas_fontes);
  const numFontes = num(extractedData.numero_fontes_renda);
  const dividendos = num(extractedData.dividendos_recebidos);

  const w1 = getConfiguredWeight(config, "pfIrpf", "pf_comprometimento");
  const w2 = getConfiguredWeight(config, "pfIrpf", "pf_evolucao");
  const w3 = getConfiguredWeight(config, "pfIrpf", "pf_patrimonio_renda");
  const w4 = getConfiguredWeight(config, "pfIrpf", "pf_endividamento");
  const w5 = getConfiguredWeight(config, "pfIrpf", "pf_estabilidade");
  const w6 = getConfiguredWeight(config, "pfIrpf", "pf_bens_reais");
  const w7 = getConfiguredWeight(config, "pfIrpf", "pf_coerencia");

  // 1. Comprometimento de renda
  const taxa = fp.taxaMensal / 100;
  const parcela = calcParcela(valor, taxa, prazo);
  const comprometimento = rendaMensal > 0 ? parcela / rendaMensal : 1;
  let pts1 = 0; let det1 = "";
  if (comprometimento < 0.25) { pts1 = w1; det1 = `${(comprometimento * 100).toFixed(1)}% (<25%)`; }
  else if (comprometimento <= 0.35) { pts1 = Math.round(w1 * 0.72); det1 = `${(comprometimento * 100).toFixed(1)}% (25-35%)`; }
  else if (comprometimento <= 0.50) { pts1 = Math.round(w1 * 0.36); det1 = `${(comprometimento * 100).toFixed(1)}% (35-50%)`; }
  else { pts1 = 0; det1 = `${(comprometimento * 100).toFixed(1)}% (>50%)`; }
  breakdown.push({ category: "Comprometimento de Renda", maxPoints: w1, points: pts1, detail: det1 });

  // 2. Evolução patrimonial
  const evolucao = rendaAnual > 0 ? (bensAtual - bensAnterior) / rendaAnual : -1;
  let pts2 = 0; let det2 = "";
  if (evolucao < 0) { pts2 = 0; det2 = "Negativa"; }
  else if (evolucao < 0.05) { pts2 = Math.round(w2 * 0.10); det2 = `${(evolucao * 100).toFixed(1)}% (<5%)`; }
  else if (evolucao < 0.10) { pts2 = Math.round(w2 * 0.40); det2 = `${(evolucao * 100).toFixed(1)}% (5-10%)`; }
  else if (evolucao <= 0.20) { pts2 = Math.round(w2 * 0.75); det2 = `${(evolucao * 100).toFixed(1)}% (10-20%)`; }
  else { pts2 = w2; det2 = `${(evolucao * 100).toFixed(1)}% (>20%)`; }
  breakdown.push({ category: "Evolução Patrimonial", maxPoints: w2, points: pts2, detail: det2 });

  // 3. Patrimônio vs Renda
  const ratio = rendaAnual > 0 ? bensAtual / rendaAnual : 0;
  let pts3 = 0; const det3 = `${ratio.toFixed(2)}x`;
  if (ratio > 2) pts3 = w3; else if (ratio >= 1) pts3 = Math.round(w3 * 0.67); else if (ratio >= 0.5) pts3 = Math.round(w3 * 0.33); else pts3 = Math.round(w3 * 0.07);
  breakdown.push({ category: "Patrimônio vs Renda", maxPoints: w3, points: pts3, detail: det3 });

  // 4. Endividamento
  let pts4 = 0; let det4 = "";
  if (dividasTotal === 0) { pts4 = w4; det4 = "Sem dívidas"; }
  else if (bensAtual > 0) {
    const debtRatio = dividasTotal / bensAtual;
    if (debtRatio < 0.30) { pts4 = Math.round(w4 * 0.67); det4 = `${(debtRatio * 100).toFixed(1)}% (<30%)`; }
    else if (debtRatio <= 0.60) { pts4 = Math.round(w4 * 0.33); det4 = `${(debtRatio * 100).toFixed(1)}% (30-60%)`; }
    else { pts4 = 0; det4 = `${(debtRatio * 100).toFixed(1)}% (>60%)`; }
  } else { pts4 = 0; det4 = "Patrimônio zero"; }
  breakdown.push({ category: "Endividamento", maxPoints: w4, points: pts4, detail: det4 });

  // 5. Estabilidade de renda
  let pts5 = Math.round(w5 * 0.60); let det5 = "Fonte única";
  if (multiplasFontes || (numFontes > 1 && dividendos > 0)) { pts5 = w5; det5 = "Múltiplas fontes + dividendos"; }
  else if (numFontes > 1) { pts5 = Math.round(w5 * 0.80); det5 = "Múltiplas fontes"; }
  else if (rendaAnual > 0 && dividendos > 0) { pts5 = w5; det5 = "Emprego + dividendos"; }
  breakdown.push({ category: "Estabilidade de Renda", maxPoints: w5, points: pts5, detail: det5 });

  // 6. Posse de bens reais
  let pts6 = 0; const det6Parts: string[] = [];
  if (possuiImovel) { pts6 += Math.round(w6 * 0.60); det6Parts.push("Imóvel"); }
  if (possuiVeiculo) { pts6 += Math.round(w6 * 0.40); det6Parts.push("Veículo"); }
  const det6 = det6Parts.length ? det6Parts.join(" + ") : "Nenhum bem real";
  breakdown.push({ category: "Posse de Bens Reais", maxPoints: w6, points: pts6, detail: det6 });

  // 7. Coerência tributária
  let pts7 = 0; let det7 = "Inconsistente ou não informado";
  if (aliquota > 0 && impostoDevido > 0) { pts7 = w7; det7 = `Alíquota ${aliquota}% — coerente`; }
  breakdown.push({ category: "Coerência Tributária", maxPoints: w7, points: pts7, detail: det7 });

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = makeDecision(score, insufficientData, config);

  const result: ScoringResult = {
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pf",
    extractedData, formData: { valor, prazo, finalidade },
  };
  saveResult(result);
  return result;
}

// ===================== PJ SCORING =====================
// Criteria IDs for balanço-based vs faturamento-based analysis
const BALANCO_CRITERIA = ["pj_liquidez", "pj_margem", "pj_endividamento", "pj_comprometimento_pl", "pj_pl"];
const FATURAMENTO_CRITERIA = ["pj_evolucao_fat", "pj_regularidade"];

export function scorePJ(
  extractedData: Record<string, any>,
  valor: number,
  prazo: number,
  finalidade: string
): ScoringResult {
  const config = loadConfig();
  const fp = config.financialParams;

  const pjDocType: "balancos" | "faturamento" = extractedData.pjDocType || "balancos";

  // Determine which criteria are active based on doc type
  const excludedIds = pjDocType === "balancos" ? FATURAMENTO_CRITERIA : BALANCO_CRITERIA;

  // Calculate total weight of active criteria for redistribution
  const allWeights: Record<string, number> = {};
  let activeTotal = 0;
  let excludedTotal = 0;
  for (const c of config.pj) {
    allWeights[c.id] = c.maxPoints;
    if (excludedIds.includes(c.id)) {
      excludedTotal += c.maxPoints;
    } else {
      activeTotal += c.maxPoints;
    }
  }

  // Redistribution factor: scale active weights so they sum to 1000
  const redistributionFactor = activeTotal > 0 ? 1000 / activeTotal : 1;

  const getWeight = (id: string): number => {
    if (excludedIds.includes(id)) return 0;
    const base = getConfiguredWeight(config, "pj", id);
    return Math.round(base * redistributionFactor);
  };

  const breakdown: ScoreBreakdown[] = [];

  const balancos = extractedData.balancos?.balancos || extractedData.balancos || [];
  const faturamento = extractedData.faturamento || {};
  const lastBalanco = Array.isArray(balancos) && balancos.length > 0 ? balancos[balancos.length - 1] : {};
  const prevBalanco = Array.isArray(balancos) && balancos.length > 1 ? balancos[balancos.length - 2] : null;

  const ativoCirculante = num(lastBalanco.ativo_circulante);
  const passivoCirculante = num(lastBalanco.passivo_circulante);
  const passivoNaoCirculante = num(lastBalanco.passivo_nao_circulante);
  const ativoTotal = num(lastBalanco.ativo_total);
  const patrimonioLiquido = num(lastBalanco.patrimonio_liquido);
  const plAnterior = prevBalanco ? num(prevBalanco.patrimonio_liquido) : 0;
  const receitaBruta = num(lastBalanco.receita_bruta) || num(lastBalanco.receita_liquida);
  const lucroLiquido = num(lastBalanco.lucro_liquido);

  const fatTotal = num(faturamento.faturamento_total_12_meses) || num(faturamento.faturamento_total_12m);
  const mediaMensal = num(faturamento.media_mensal);
  const cv = num(faturamento.coeficiente_variacao_percentual);
  const tempoMercado = num(extractedData.tempo_mercado_anos) || num(extractedData.balancos?.tempo_mercado_anos) || 0;

  // Determine key fields based on doc type for insufficiency check
  const keyVals = pjDocType === "balancos"
    ? [ativoCirculante, passivoCirculante, ativoTotal, patrimonioLiquido, receitaBruta]
    : [fatTotal, mediaMensal];
  const missingCount = keyVals.filter((v) => v === 0).length;
  const insufficientData = missingCount > keyVals.length * (fp.percentualMinimoExtracoes / 100);

  // 1. Liquidez corrente — AC/PC (balanço only)
  const w1 = getWeight("pj_liquidez");
  if (w1 > 0) {
    const lc = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0;
    let pts1 = 0; let det1 = `${lc.toFixed(2)}`;
    if (lc > 1.5) { pts1 = w1; det1 += " (>1.5)"; }
    else if (lc >= 1.2) { pts1 = Math.round(w1 * 0.80); det1 += " (1.2-1.5)"; }
    else if (lc >= 1.0) { pts1 = Math.round(w1 * 0.47); det1 += " (1.0-1.2)"; }
    else { pts1 = 0; det1 += " (<1.0)"; }
    breakdown.push({ category: "Liquidez Corrente", maxPoints: w1, points: pts1, detail: det1 });
  }

  // 2. Evolução faturamento (faturamento only)
  const w2 = getWeight("pj_evolucao_fat");
  if (w2 > 0) {
    const fatMensal = faturamento.faturamento_mensal || [];
    let crescimento = 0;
    if (Array.isArray(fatMensal) && fatMensal.length >= 6) {
      const firstHalf = fatMensal.slice(0, 6).reduce((s: number, m: any) => s + num(m.valor), 0);
      const secondHalf = fatMensal.slice(-6).reduce((s: number, m: any) => s + num(m.valor), 0);
      crescimento = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    }
    let pts2 = Math.round(w2 * 0.40); let det2 = "";
    if (crescimento > 10) { pts2 = w2; det2 = `Crescimento ${crescimento.toFixed(1)}% (>10%)`; }
    else if (crescimento > 0) { pts2 = Math.round(w2 * 0.67); det2 = `Crescimento ${crescimento.toFixed(1)}% (0-10%)`; }
    else if (crescimento === 0) { pts2 = Math.round(w2 * 0.40); det2 = "Estável"; }
    else { pts2 = 0; det2 = `Queda ${crescimento.toFixed(1)}%`; }
    breakdown.push({ category: "Evolução Faturamento", maxPoints: w2, points: pts2, detail: det2 });
  }

  // 3. Margem lucro — LL/RB (balanço only)
  const w3 = getWeight("pj_margem");
  if (w3 > 0) {
    const rb = receitaBruta || fatTotal;
    const margem = rb > 0 ? (lucroLiquido / rb) * 100 : -1;
    let pts3 = 0; let det3 = "";
    if (margem < 0) { pts3 = 0; det3 = "Negativa"; }
    else if (margem < 3) { pts3 = Math.round(w3 * 0.13); det3 = `${margem.toFixed(1)}% (0-3%)`; }
    else if (margem < 8) { pts3 = Math.round(w3 * 0.40); det3 = `${margem.toFixed(1)}% (3-8%)`; }
    else if (margem <= 15) { pts3 = Math.round(w3 * 0.73); det3 = `${margem.toFixed(1)}% (8-15%)`; }
    else { pts3 = w3; det3 = `${margem.toFixed(1)}% (>15%)`; }
    breakdown.push({ category: "Margem de Lucro", maxPoints: w3, points: pts3, detail: det3 });
  }

  // 4. Endividamento — (PC+PNC)/AT (balanço only)
  const w4 = getWeight("pj_endividamento");
  if (w4 > 0) {
    const endiv = ativoTotal > 0 ? ((passivoCirculante + passivoNaoCirculante) / ativoTotal) * 100 : 100;
    let pts4 = 0; let det4 = `${endiv.toFixed(1)}%`;
    if (endiv < 40) { pts4 = w4; det4 += " (<40%)"; }
    else if (endiv <= 60) { pts4 = Math.round(w4 * 0.67); det4 += " (40-60%)"; }
    else if (endiv <= 80) { pts4 = Math.round(w4 * 0.27); det4 += " (60-80%)"; }
    else { pts4 = 0; det4 += " (>80%)"; }
    breakdown.push({ category: "Endividamento", maxPoints: w4, points: pts4, detail: det4 });
  }

  // 5. Comprometimento crédito/PL (balanço only)
  const w5 = getWeight("pj_comprometimento_pl");
  if (w5 > 0) {
    const compPL = patrimonioLiquido > 0 ? (valor / patrimonioLiquido) * 100 : 200;
    let pts5 = 0; let det5 = `${compPL.toFixed(1)}%`;
    if (compPL < 30) { pts5 = w5; det5 += " (<30%)"; }
    else if (compPL <= 60) { pts5 = Math.round(w5 * 0.60); det5 += " (30-60%)"; }
    else if (compPL <= 100) { pts5 = Math.round(w5 * 0.20); det5 += " (60-100%)"; }
    else { pts5 = 0; det5 += " (>100%)"; }
    breakdown.push({ category: "Comprometimento Crédito/PL", maxPoints: w5, points: pts5, detail: det5 });
  }

  // 6. Regularidade faturamento — CV (faturamento only)
  const w6 = getWeight("pj_regularidade");
  if (w6 > 0) {
    const fatMensal = faturamento.faturamento_mensal || [];
    let pts6 = Math.round(w6 * 0.70); let det6 = "";
    if (cv > 0) {
      if (cv < 15) { pts6 = w6; det6 = `CV ${cv.toFixed(1)}% (<15%)`; }
      else if (cv <= 30) { pts6 = Math.round(w6 * 0.70); det6 = `CV ${cv.toFixed(1)}% (15-30%)`; }
      else if (cv <= 50) { pts6 = Math.round(w6 * 0.30); det6 = `CV ${cv.toFixed(1)}% (30-50%)`; }
      else { pts6 = 0; det6 = `CV ${cv.toFixed(1)}% (>50%)`; }
    } else {
      if (Array.isArray(fatMensal) && fatMensal.length >= 6 && mediaMensal > 0) {
        const vals = fatMensal.map((m: any) => num(m.valor));
        const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        const variance = vals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / vals.length;
        const estCV = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 50;
        if (estCV < 15) { pts6 = w6; det6 = `CV est. ${estCV.toFixed(1)}% (<15%)`; }
        else if (estCV <= 30) { pts6 = Math.round(w6 * 0.70); det6 = `CV est. ${estCV.toFixed(1)}% (15-30%)`; }
        else if (estCV <= 50) { pts6 = Math.round(w6 * 0.30); det6 = `CV est. ${estCV.toFixed(1)}% (30-50%)`; }
        else { pts6 = 0; det6 = `CV est. ${estCV.toFixed(1)}% (>50%)`; }
      } else {
        det6 = "CV não informado";
      }
    }
    breakdown.push({ category: "Regularidade Faturamento", maxPoints: w6, points: pts6, detail: det6 });
  }

  // 7. Tempo de mercado (always active)
  const w7 = getWeight("pj_tempo_mercado");
  if (w7 > 0) {
    let pts7 = Math.round(w7 * 0.40); let det7 = "";
    if (tempoMercado > 10) { pts7 = w7; det7 = `${tempoMercado} anos (>10)`; }
    else if (tempoMercado >= 5) { pts7 = Math.round(w7 * 0.70); det7 = `${tempoMercado} anos (5-10)`; }
    else if (tempoMercado >= 3) { pts7 = Math.round(w7 * 0.40); det7 = `${tempoMercado} anos (3-5)`; }
    else if (tempoMercado >= 1) { pts7 = Math.round(w7 * 0.20); det7 = `${tempoMercado} anos (1-3)`; }
    else if (tempoMercado > 0) { pts7 = 0; det7 = `${tempoMercado} anos (<1)`; }
    else { pts7 = Math.round(w7 * 0.40); det7 = "Não informado (padrão 3-5)"; }
    breakdown.push({ category: "Tempo de Mercado", maxPoints: w7, points: pts7, detail: det7 });
  }

  // 8. PL positivo/crescente (balanço only)
  const w8 = getWeight("pj_pl");
  if (w8 > 0) {
    let pts8 = 0; let det8 = "";
    if (patrimonioLiquido <= 0) { pts8 = 0; det8 = "PL negativo"; }
    else if (prevBalanco && patrimonioLiquido > plAnterior) { pts8 = w8; det8 = "Positivo e crescente"; }
    else if (prevBalanco && patrimonioLiquido <= plAnterior) { pts8 = Math.round(w8 * 0.50); det8 = "Positivo, mas em queda"; }
    else { pts8 = Math.round(w8 * 0.50); det8 = "Positivo (sem comparação)"; }
    breakdown.push({ category: "PL Positivo/Crescente", maxPoints: w8, points: pts8, detail: det8 });
  }

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = makeDecision(score, insufficientData, config);

  const result: ScoringResult = {
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pj",
    pjDocType,
    extractedData, formData: { valor, prazo, finalidade },
  };
  saveResult(result);
  return result;
}
  const faturamento = extractedData.faturamento || {};
  const lastBalanco = Array.isArray(balancos) && balancos.length > 0 ? balancos[balancos.length - 1] : {};
  const prevBalanco = Array.isArray(balancos) && balancos.length > 1 ? balancos[balancos.length - 2] : null;

  const ativoCirculante = num(lastBalanco.ativo_circulante);
  const passivoCirculante = num(lastBalanco.passivo_circulante);
  const passivoNaoCirculante = num(lastBalanco.passivo_nao_circulante);
  const ativoTotal = num(lastBalanco.ativo_total);
  const patrimonioLiquido = num(lastBalanco.patrimonio_liquido);
  const plAnterior = prevBalanco ? num(prevBalanco.patrimonio_liquido) : 0;
  const receitaBruta = num(lastBalanco.receita_bruta) || num(lastBalanco.receita_liquida);
  const lucroLiquido = num(lastBalanco.lucro_liquido);

  const fatTotal = num(faturamento.faturamento_total_12_meses) || num(faturamento.faturamento_total_12m);
  const mediaMensal = num(faturamento.media_mensal);
  const cv = num(faturamento.coeficiente_variacao_percentual);
  const tempoMercado = num(extractedData.tempo_mercado_anos) || num(extractedData.balancos?.tempo_mercado_anos) || 0;

  const keyVals = [ativoCirculante, passivoCirculante, ativoTotal, patrimonioLiquido, receitaBruta, fatTotal, mediaMensal];
  const missingCount = keyVals.filter((v) => v === 0).length;
  const insufficientData = missingCount > keyVals.length * (fp.percentualMinimoExtracoes / 100);

  const w1 = getConfiguredWeight(config, "pj", "pj_liquidez");
  const w2 = getConfiguredWeight(config, "pj", "pj_evolucao_fat");
  const w3 = getConfiguredWeight(config, "pj", "pj_margem");
  const w4 = getConfiguredWeight(config, "pj", "pj_endividamento");
  const w5 = getConfiguredWeight(config, "pj", "pj_comprometimento_pl");
  const w6 = getConfiguredWeight(config, "pj", "pj_regularidade");
  const w7 = getConfiguredWeight(config, "pj", "pj_tempo_mercado");
  const w8 = getConfiguredWeight(config, "pj", "pj_pl");

  // 1. Liquidez corrente — AC/PC
  const lc = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0;
  let pts1 = 0; let det1 = `${lc.toFixed(2)}`;
  if (lc > 1.5) { pts1 = w1; det1 += " (>1.5)"; }
  else if (lc >= 1.2) { pts1 = Math.round(w1 * 0.80); det1 += " (1.2-1.5)"; }
  else if (lc >= 1.0) { pts1 = Math.round(w1 * 0.47); det1 += " (1.0-1.2)"; }
  else { pts1 = 0; det1 += " (<1.0)"; }
  breakdown.push({ category: "Liquidez Corrente", maxPoints: w1, points: pts1, detail: det1 });

  // 2. Evolução faturamento
  const fatMensal = faturamento.faturamento_mensal || [];
  let crescimento = 0;
  if (Array.isArray(fatMensal) && fatMensal.length >= 6) {
    const firstHalf = fatMensal.slice(0, 6).reduce((s: number, m: any) => s + num(m.valor), 0);
    const secondHalf = fatMensal.slice(-6).reduce((s: number, m: any) => s + num(m.valor), 0);
    crescimento = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
  }
  let pts2 = Math.round(w2 * 0.40); let det2 = "";
  if (crescimento > 10) { pts2 = w2; det2 = `Crescimento ${crescimento.toFixed(1)}% (>10%)`; }
  else if (crescimento > 0) { pts2 = Math.round(w2 * 0.67); det2 = `Crescimento ${crescimento.toFixed(1)}% (0-10%)`; }
  else if (crescimento === 0) { pts2 = Math.round(w2 * 0.40); det2 = "Estável"; }
  else { pts2 = 0; det2 = `Queda ${crescimento.toFixed(1)}%`; }
  breakdown.push({ category: "Evolução Faturamento", maxPoints: w2, points: pts2, detail: det2 });

  // 3. Margem lucro — LL/RB
  const rb = receitaBruta || fatTotal;
  const margem = rb > 0 ? (lucroLiquido / rb) * 100 : -1;
  let pts3 = 0; let det3 = "";
  if (margem < 0) { pts3 = 0; det3 = "Negativa"; }
  else if (margem < 3) { pts3 = Math.round(w3 * 0.13); det3 = `${margem.toFixed(1)}% (0-3%)`; }
  else if (margem < 8) { pts3 = Math.round(w3 * 0.40); det3 = `${margem.toFixed(1)}% (3-8%)`; }
  else if (margem <= 15) { pts3 = Math.round(w3 * 0.73); det3 = `${margem.toFixed(1)}% (8-15%)`; }
  else { pts3 = w3; det3 = `${margem.toFixed(1)}% (>15%)`; }
  breakdown.push({ category: "Margem de Lucro", maxPoints: w3, points: pts3, detail: det3 });

  // 4. Endividamento — (PC+PNC)/AT
  const endiv = ativoTotal > 0 ? ((passivoCirculante + passivoNaoCirculante) / ativoTotal) * 100 : 100;
  let pts4 = 0; let det4 = `${endiv.toFixed(1)}%`;
  if (endiv < 40) { pts4 = w4; det4 += " (<40%)"; }
  else if (endiv <= 60) { pts4 = Math.round(w4 * 0.67); det4 += " (40-60%)"; }
  else if (endiv <= 80) { pts4 = Math.round(w4 * 0.27); det4 += " (60-80%)"; }
  else { pts4 = 0; det4 += " (>80%)"; }
  breakdown.push({ category: "Endividamento", maxPoints: w4, points: pts4, detail: det4 });

  // 5. Comprometimento crédito/PL
  const compPL = patrimonioLiquido > 0 ? (valor / patrimonioLiquido) * 100 : 200;
  let pts5 = 0; let det5 = `${compPL.toFixed(1)}%`;
  if (compPL < 30) { pts5 = w5; det5 += " (<30%)"; }
  else if (compPL <= 60) { pts5 = Math.round(w5 * 0.60); det5 += " (30-60%)"; }
  else if (compPL <= 100) { pts5 = Math.round(w5 * 0.20); det5 += " (60-100%)"; }
  else { pts5 = 0; det5 += " (>100%)"; }
  breakdown.push({ category: "Comprometimento Crédito/PL", maxPoints: w5, points: pts5, detail: det5 });

  // 6. Regularidade faturamento — CV
  let pts6 = Math.round(w6 * 0.70); let det6 = "";
  if (cv > 0) {
    if (cv < 15) { pts6 = w6; det6 = `CV ${cv.toFixed(1)}% (<15%)`; }
    else if (cv <= 30) { pts6 = Math.round(w6 * 0.70); det6 = `CV ${cv.toFixed(1)}% (15-30%)`; }
    else if (cv <= 50) { pts6 = Math.round(w6 * 0.30); det6 = `CV ${cv.toFixed(1)}% (30-50%)`; }
    else { pts6 = 0; det6 = `CV ${cv.toFixed(1)}% (>50%)`; }
  } else {
    if (Array.isArray(fatMensal) && fatMensal.length >= 6 && mediaMensal > 0) {
      const vals = fatMensal.map((m: any) => num(m.valor));
      const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      const variance = vals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / vals.length;
      const estCV = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 50;
      if (estCV < 15) { pts6 = w6; det6 = `CV est. ${estCV.toFixed(1)}% (<15%)`; }
      else if (estCV <= 30) { pts6 = Math.round(w6 * 0.70); det6 = `CV est. ${estCV.toFixed(1)}% (15-30%)`; }
      else if (estCV <= 50) { pts6 = Math.round(w6 * 0.30); det6 = `CV est. ${estCV.toFixed(1)}% (30-50%)`; }
      else { pts6 = 0; det6 = `CV est. ${estCV.toFixed(1)}% (>50%)`; }
    } else {
      det6 = "CV não informado";
    }
  }
  breakdown.push({ category: "Regularidade Faturamento", maxPoints: w6, points: pts6, detail: det6 });

  // 7. Tempo de mercado
  let pts7 = Math.round(w7 * 0.40); let det7 = "";
  if (tempoMercado > 10) { pts7 = w7; det7 = `${tempoMercado} anos (>10)`; }
  else if (tempoMercado >= 5) { pts7 = Math.round(w7 * 0.70); det7 = `${tempoMercado} anos (5-10)`; }
  else if (tempoMercado >= 3) { pts7 = Math.round(w7 * 0.40); det7 = `${tempoMercado} anos (3-5)`; }
  else if (tempoMercado >= 1) { pts7 = Math.round(w7 * 0.20); det7 = `${tempoMercado} anos (1-3)`; }
  else if (tempoMercado > 0) { pts7 = 0; det7 = `${tempoMercado} anos (<1)`; }
  else { pts7 = Math.round(w7 * 0.40); det7 = "Não informado (padrão 3-5)"; }
  breakdown.push({ category: "Tempo de Mercado", maxPoints: w7, points: pts7, detail: det7 });

  // 8. PL positivo/crescente
  let pts8 = 0; let det8 = "";
  if (patrimonioLiquido <= 0) { pts8 = 0; det8 = "PL negativo"; }
  else if (prevBalanco && patrimonioLiquido > plAnterior) { pts8 = w8; det8 = "Positivo e crescente"; }
  else if (prevBalanco && patrimonioLiquido <= plAnterior) { pts8 = Math.round(w8 * 0.50); det8 = "Positivo, mas em queda"; }
  else { pts8 = Math.round(w8 * 0.50); det8 = "Positivo (sem comparação)"; }
  breakdown.push({ category: "PL Positivo/Crescente", maxPoints: w8, points: pts8, detail: det8 });

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = makeDecision(score, insufficientData, config);

  const result: ScoringResult = {
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pj",
    extractedData, formData: { valor, prazo, finalidade },
  };
  saveResult(result);
  return result;
}
