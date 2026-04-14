// Credit Scoring Engine — Pessoa Física (IRPF) + Pessoa Jurídica (PJ)

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

function makeDecision(score: number, insufficientData: boolean) {
  let decision: string;
  let decisionColor: string;
  if (insufficientData) {
    decision = "ANÁLISE INCONCLUSIVA — DADOS INSUFICIENTES";
    decisionColor = "#6b7280";
  } else if (score >= 750) {
    decision = "CRÉDITO APROVADO";
    decisionColor = "#16a34a";
  } else if (score >= 500) {
    decision = "APROVADO COM RESSALVAS";
    decisionColor = "#ea580c";
  } else if (score >= 300) {
    decision = "CRÉDITO REPROVADO";
    decisionColor = "#dc2626";
  } else {
    decision = "CRÉDITO REPROVADO — RISCO ELEVADO";
    decisionColor = "#991b1b";
  }
  return { decision, decisionColor };
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
  const breakdown: ScoreBreakdown[] = [];

  const keyFields = [
    "renda_total_anual", "bens_direitos_total_atual", "bens_direitos_total_anterior",
    "dividas_onus_total_atual", "possui_imovel", "possui_veiculo",
    "aliquota_efetiva_percentual", "imposto_devido_total",
  ];
  const missingCount = keyFields.filter((k) => isMissing(extractedData[k])).length;
  const insufficientData = missingCount > keyFields.length * 0.5;

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

  // 1. Comprometimento de renda (250pts)
  const parcela = calcParcela(valor, 0.02, prazo);
  const comprometimento = rendaMensal > 0 ? parcela / rendaMensal : 1;
  let pts1 = 0; let det1 = "";
  if (comprometimento < 0.25) { pts1 = 250; det1 = `${(comprometimento * 100).toFixed(1)}% (<25%)`; }
  else if (comprometimento <= 0.35) { pts1 = 180; det1 = `${(comprometimento * 100).toFixed(1)}% (25-35%)`; }
  else if (comprometimento <= 0.50) { pts1 = 90; det1 = `${(comprometimento * 100).toFixed(1)}% (35-50%)`; }
  else { pts1 = 0; det1 = `${(comprometimento * 100).toFixed(1)}% (>50%)`; }
  breakdown.push({ category: "Comprometimento de Renda", maxPoints: 250, points: pts1, detail: det1 });

  // 2. Evolução patrimonial (200pts)
  const evolucao = rendaAnual > 0 ? (bensAtual - bensAnterior) / rendaAnual : -1;
  let pts2 = 0; let det2 = "";
  if (evolucao < 0) { pts2 = 0; det2 = "Negativa"; }
  else if (evolucao < 0.05) { pts2 = 20; det2 = `${(evolucao * 100).toFixed(1)}% (<5%)`; }
  else if (evolucao < 0.10) { pts2 = 80; det2 = `${(evolucao * 100).toFixed(1)}% (5-10%)`; }
  else if (evolucao <= 0.20) { pts2 = 150; det2 = `${(evolucao * 100).toFixed(1)}% (10-20%)`; }
  else { pts2 = 200; det2 = `${(evolucao * 100).toFixed(1)}% (>20%)`; }
  breakdown.push({ category: "Evolução Patrimonial", maxPoints: 200, points: pts2, detail: det2 });

  // 3. Patrimônio vs Renda (150pts)
  const ratio = rendaAnual > 0 ? bensAtual / rendaAnual : 0;
  let pts3 = 0; const det3 = `${ratio.toFixed(2)}x`;
  if (ratio > 2) pts3 = 150; else if (ratio >= 1) pts3 = 100; else if (ratio >= 0.5) pts3 = 50; else pts3 = 10;
  breakdown.push({ category: "Patrimônio vs Renda", maxPoints: 150, points: pts3, detail: det3 });

  // 4. Endividamento (150pts)
  let pts4 = 0; let det4 = "";
  if (dividasTotal === 0) { pts4 = 150; det4 = "Sem dívidas"; }
  else if (bensAtual > 0) {
    const debtRatio = dividasTotal / bensAtual;
    if (debtRatio < 0.30) { pts4 = 100; det4 = `${(debtRatio * 100).toFixed(1)}% (<30%)`; }
    else if (debtRatio <= 0.60) { pts4 = 50; det4 = `${(debtRatio * 100).toFixed(1)}% (30-60%)`; }
    else { pts4 = 0; det4 = `${(debtRatio * 100).toFixed(1)}% (>60%)`; }
  } else { pts4 = 0; det4 = "Patrimônio zero"; }
  breakdown.push({ category: "Endividamento", maxPoints: 150, points: pts4, detail: det4 });

  // 5. Estabilidade de renda (100pts)
  let pts5 = 60; let det5 = "Fonte única";
  if (multiplasFontes || (numFontes > 1 && dividendos > 0)) { pts5 = 100; det5 = "Múltiplas fontes + dividendos"; }
  else if (numFontes > 1) { pts5 = 80; det5 = "Múltiplas fontes"; }
  else if (rendaAnual > 0 && dividendos > 0) { pts5 = 100; det5 = "Emprego + dividendos"; }
  breakdown.push({ category: "Estabilidade de Renda", maxPoints: 100, points: pts5, detail: det5 });

  // 6. Posse de bens reais (100pts)
  let pts6 = 0; const det6Parts: string[] = [];
  if (possuiImovel) { pts6 += 60; det6Parts.push("Imóvel"); }
  if (possuiVeiculo) { pts6 += 40; det6Parts.push("Veículo"); }
  const det6 = det6Parts.length ? det6Parts.join(" + ") : "Nenhum bem real";
  breakdown.push({ category: "Posse de Bens Reais", maxPoints: 100, points: pts6, detail: det6 });

  // 7. Coerência tributária (50pts)
  let pts7 = 0; let det7 = "Inconsistente ou não informado";
  if (aliquota > 0 && impostoDevido > 0) { pts7 = 50; det7 = `Alíquota ${aliquota}% — coerente`; }
  breakdown.push({ category: "Coerência Tributária", maxPoints: 50, points: pts7, detail: det7 });

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = makeDecision(score, insufficientData);

  const result: ScoringResult = {
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pf",
    extractedData, formData: { valor, prazo, finalidade },
  };
  saveResult(result);
  return result;
}

// ===================== PJ SCORING =====================
export function scorePJ(
  extractedData: Record<string, any>,
  valor: number,
  prazo: number,
  finalidade: string
): ScoringResult {
  const breakdown: ScoreBreakdown[] = [];

  // Extract PJ data from nested structure
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

  // Estimate tempo de mercado from razao_social or cnpj — default 5 if unknown
  const tempoMercado = num(extractedData.tempo_mercado_anos) || num(extractedData.balancos?.tempo_mercado_anos) || 0;

  // Check data sufficiency
  const keyVals = [ativoCirculante, passivoCirculante, ativoTotal, patrimonioLiquido, receitaBruta, fatTotal, mediaMensal];
  const missingCount = keyVals.filter((v) => v === 0).length;
  const insufficientData = missingCount > keyVals.length * 0.5;

  // 1. Liquidez corrente (150pts) — AC/PC
  const lc = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0;
  let pts1 = 0; let det1 = `${lc.toFixed(2)}`;
  if (lc > 1.5) { pts1 = 150; det1 += " (>1.5)"; }
  else if (lc >= 1.2) { pts1 = 120; det1 += " (1.2-1.5)"; }
  else if (lc >= 1.0) { pts1 = 70; det1 += " (1.0-1.2)"; }
  else { pts1 = 0; det1 += " (<1.0)"; }
  breakdown.push({ category: "Liquidez Corrente", maxPoints: 150, points: pts1, detail: det1 });

  // 2. Evolução faturamento (150pts)
  // Estimate growth from monthly data if available
  const fatMensal = faturamento.faturamento_mensal || [];
  let crescimento = 0;
  if (Array.isArray(fatMensal) && fatMensal.length >= 6) {
    const firstHalf = fatMensal.slice(0, 6).reduce((s: number, m: any) => s + num(m.valor), 0);
    const secondHalf = fatMensal.slice(-6).reduce((s: number, m: any) => s + num(m.valor), 0);
    crescimento = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
  }
  let pts2 = 60; let det2 = "";
  if (crescimento > 10) { pts2 = 150; det2 = `Crescimento ${crescimento.toFixed(1)}% (>10%)`; }
  else if (crescimento > 0) { pts2 = 100; det2 = `Crescimento ${crescimento.toFixed(1)}% (0-10%)`; }
  else if (crescimento === 0) { pts2 = 60; det2 = "Estável"; }
  else { pts2 = 0; det2 = `Queda ${crescimento.toFixed(1)}%`; }
  breakdown.push({ category: "Evolução Faturamento", maxPoints: 150, points: pts2, detail: det2 });

  // 3. Margem lucro (150pts) — LL/RB
  const rb = receitaBruta || fatTotal;
  const margem = rb > 0 ? (lucroLiquido / rb) * 100 : -1;
  let pts3 = 0; let det3 = "";
  if (margem < 0) { pts3 = 0; det3 = "Negativa"; }
  else if (margem < 3) { pts3 = 20; det3 = `${margem.toFixed(1)}% (0-3%)`; }
  else if (margem < 8) { pts3 = 60; det3 = `${margem.toFixed(1)}% (3-8%)`; }
  else if (margem <= 15) { pts3 = 110; det3 = `${margem.toFixed(1)}% (8-15%)`; }
  else { pts3 = 150; det3 = `${margem.toFixed(1)}% (>15%)`; }
  breakdown.push({ category: "Margem de Lucro", maxPoints: 150, points: pts3, detail: det3 });

  // 4. Endividamento (150pts) — (PC+PNC)/AT
  const endiv = ativoTotal > 0 ? ((passivoCirculante + passivoNaoCirculante) / ativoTotal) * 100 : 100;
  let pts4 = 0; let det4 = `${endiv.toFixed(1)}%`;
  if (endiv < 40) { pts4 = 150; det4 += " (<40%)"; }
  else if (endiv <= 60) { pts4 = 100; det4 += " (40-60%)"; }
  else if (endiv <= 80) { pts4 = 40; det4 += " (60-80%)"; }
  else { pts4 = 0; det4 += " (>80%)"; }
  breakdown.push({ category: "Endividamento", maxPoints: 150, points: pts4, detail: det4 });

  // 5. Comprometimento crédito/PL (100pts)
  const compPL = patrimonioLiquido > 0 ? (valor / patrimonioLiquido) * 100 : 200;
  let pts5 = 0; let det5 = `${compPL.toFixed(1)}%`;
  if (compPL < 30) { pts5 = 100; det5 += " (<30%)"; }
  else if (compPL <= 60) { pts5 = 60; det5 += " (30-60%)"; }
  else if (compPL <= 100) { pts5 = 20; det5 += " (60-100%)"; }
  else { pts5 = 0; det5 += " (>100%)"; }
  breakdown.push({ category: "Comprometimento Crédito/PL", maxPoints: 100, points: pts5, detail: det5 });

  // 6. Regularidade faturamento (100pts) — CV
  let pts6 = 70; let det6 = "";
  if (cv > 0) {
    if (cv < 15) { pts6 = 100; det6 = `CV ${cv.toFixed(1)}% (<15%)`; }
    else if (cv <= 30) { pts6 = 70; det6 = `CV ${cv.toFixed(1)}% (15-30%)`; }
    else if (cv <= 50) { pts6 = 30; det6 = `CV ${cv.toFixed(1)}% (30-50%)`; }
    else { pts6 = 0; det6 = `CV ${cv.toFixed(1)}% (>50%)`; }
  } else {
    // Estimate CV from monthly data
    if (Array.isArray(fatMensal) && fatMensal.length >= 6 && mediaMensal > 0) {
      const vals = fatMensal.map((m: any) => num(m.valor));
      const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      const variance = vals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / vals.length;
      const estCV = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 50;
      if (estCV < 15) { pts6 = 100; det6 = `CV est. ${estCV.toFixed(1)}% (<15%)`; }
      else if (estCV <= 30) { pts6 = 70; det6 = `CV est. ${estCV.toFixed(1)}% (15-30%)`; }
      else if (estCV <= 50) { pts6 = 30; det6 = `CV est. ${estCV.toFixed(1)}% (30-50%)`; }
      else { pts6 = 0; det6 = `CV est. ${estCV.toFixed(1)}% (>50%)`; }
    } else {
      det6 = "CV não informado";
    }
  }
  breakdown.push({ category: "Regularidade Faturamento", maxPoints: 100, points: pts6, detail: det6 });

  // 7. Tempo de mercado (100pts)
  let pts7 = 40; let det7 = "";
  if (tempoMercado > 10) { pts7 = 100; det7 = `${tempoMercado} anos (>10)`; }
  else if (tempoMercado >= 5) { pts7 = 70; det7 = `${tempoMercado} anos (5-10)`; }
  else if (tempoMercado >= 3) { pts7 = 40; det7 = `${tempoMercado} anos (3-5)`; }
  else if (tempoMercado >= 1) { pts7 = 20; det7 = `${tempoMercado} anos (1-3)`; }
  else if (tempoMercado > 0) { pts7 = 0; det7 = `${tempoMercado} anos (<1)`; }
  else { pts7 = 40; det7 = "Não informado (padrão 3-5)"; }
  breakdown.push({ category: "Tempo de Mercado", maxPoints: 100, points: pts7, detail: det7 });

  // 8. PL positivo/crescente (50pts)
  let pts8 = 0; let det8 = "";
  if (patrimonioLiquido <= 0) { pts8 = 0; det8 = "PL negativo"; }
  else if (prevBalanco && patrimonioLiquido > plAnterior) { pts8 = 50; det8 = "Positivo e crescente"; }
  else if (prevBalanco && patrimonioLiquido <= plAnterior) { pts8 = 25; det8 = "Positivo, mas em queda"; }
  else { pts8 = 25; det8 = "Positivo (sem comparação)"; }
  breakdown.push({ category: "PL Positivo/Crescente", maxPoints: 50, points: pts8, detail: det8 });

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = makeDecision(score, insufficientData);

  const result: ScoringResult = {
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pj",
    extractedData, formData: { valor, prazo, finalidade },
  };
  saveResult(result);
  return result;
}
