// Credit Scoring Engine — Pessoa Física (IRPF)

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

export function scorePF(
  extractedData: Record<string, any>,
  valor: number,
  prazo: number,
  finalidade: string
): ScoringResult {
  const breakdown: ScoreBreakdown[] = [];

  // Check data sufficiency
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
  let pts1 = 0;
  let det1 = "";
  if (comprometimento < 0.25) { pts1 = 250; det1 = `${(comprometimento * 100).toFixed(1)}% (<25%)`; }
  else if (comprometimento <= 0.35) { pts1 = 180; det1 = `${(comprometimento * 100).toFixed(1)}% (25-35%)`; }
  else if (comprometimento <= 0.50) { pts1 = 90; det1 = `${(comprometimento * 100).toFixed(1)}% (35-50%)`; }
  else { pts1 = 0; det1 = `${(comprometimento * 100).toFixed(1)}% (>50%)`; }
  breakdown.push({ category: "Comprometimento de Renda", maxPoints: 250, points: pts1, detail: det1 });

  // 2. Evolução patrimonial (200pts)
  const evolucao = rendaAnual > 0 ? (bensAtual - bensAnterior) / rendaAnual : -1;
  let pts2 = 0;
  let det2 = "";
  if (evolucao < 0) { pts2 = 0; det2 = "Negativa"; }
  else if (evolucao < 0.05) { pts2 = 20; det2 = `${(evolucao * 100).toFixed(1)}% (<5%)`; }
  else if (evolucao < 0.10) { pts2 = 80; det2 = `${(evolucao * 100).toFixed(1)}% (5-10%)`; }
  else if (evolucao <= 0.20) { pts2 = 150; det2 = `${(evolucao * 100).toFixed(1)}% (10-20%)`; }
  else { pts2 = 200; det2 = `${(evolucao * 100).toFixed(1)}% (>20%)`; }
  breakdown.push({ category: "Evolução Patrimonial", maxPoints: 200, points: pts2, detail: det2 });

  // 3. Patrimônio vs Renda (150pts)
  const ratio = rendaAnual > 0 ? bensAtual / rendaAnual : 0;
  let pts3 = 0;
  let det3 = `${ratio.toFixed(2)}x`;
  if (ratio > 2) pts3 = 150;
  else if (ratio >= 1) pts3 = 100;
  else if (ratio >= 0.5) pts3 = 50;
  else pts3 = 10;
  breakdown.push({ category: "Patrimônio vs Renda", maxPoints: 150, points: pts3, detail: det3 });

  // 4. Endividamento (150pts)
  let pts4 = 0;
  let det4 = "";
  if (dividasTotal === 0) { pts4 = 150; det4 = "Sem dívidas"; }
  else if (bensAtual > 0) {
    const debtRatio = dividasTotal / bensAtual;
    if (debtRatio < 0.30) { pts4 = 100; det4 = `${(debtRatio * 100).toFixed(1)}% (<30%)`; }
    else if (debtRatio <= 0.60) { pts4 = 50; det4 = `${(debtRatio * 100).toFixed(1)}% (30-60%)`; }
    else { pts4 = 0; det4 = `${(debtRatio * 100).toFixed(1)}% (>60%)`; }
  } else { pts4 = 0; det4 = "Patrimônio zero"; }
  breakdown.push({ category: "Endividamento", maxPoints: 150, points: pts4, detail: det4 });

  // 5. Estabilidade de renda (100pts)
  let pts5 = 60;
  let det5 = "Fonte única";
  if (multiplasFontes || (numFontes > 1 && dividendos > 0)) { pts5 = 100; det5 = "Múltiplas fontes + dividendos"; }
  else if (numFontes > 1) { pts5 = 80; det5 = "Múltiplas fontes"; }
  else if (rendaAnual > 0 && dividendos > 0) { pts5 = 100; det5 = "Emprego + dividendos"; }
  breakdown.push({ category: "Estabilidade de Renda", maxPoints: 100, points: pts5, detail: det5 });

  // 6. Posse de bens reais (100pts)
  let pts6 = 0;
  let det6Parts: string[] = [];
  if (possuiImovel) { pts6 += 60; det6Parts.push("Imóvel"); }
  if (possuiVeiculo) { pts6 += 40; det6Parts.push("Veículo"); }
  const det6 = det6Parts.length ? det6Parts.join(" + ") : "Nenhum bem real";
  breakdown.push({ category: "Posse de Bens Reais", maxPoints: 100, points: pts6, detail: det6 });

  // 7. Coerência tributária (50pts)
  let pts7 = 0;
  let det7 = "Inconsistente ou não informado";
  if (aliquota > 0 && impostoDevido > 0) { pts7 = 50; det7 = `Alíquota ${aliquota}% — coerente`; }
  breakdown.push({ category: "Coerência Tributária", maxPoints: 50, points: pts7, detail: det7 });

  const score = breakdown.reduce((s, b) => s + b.points, 0);

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

  const result: ScoringResult = {
    score,
    breakdown,
    decision,
    decisionColor,
    insufficientData,
    protocolo: generateProtocolo(),
    data: new Date().toISOString(),
    tipo: "pf",
    extractedData,
    formData: { valor, prazo, finalidade },
  };

  // Save to localStorage
  const history = JSON.parse(localStorage.getItem("credit_history") || "[]");
  history.unshift(result);
  localStorage.setItem("credit_history", JSON.stringify(history));

  return result;
}
