// Credit Scoring Engine — Pessoa Física (IRPF) + Pessoa Jurídica (PJ)
//
// Semântica de dados ausentes: a extração por IA retorna `null` para campos
// não encontrados no documento. `0` é SEMPRE um valor legítimo (ex.: isento
// de IR, sem dívidas declaradas) e nunca deve ser tratado como ausência.
//
// As faixas (ranges) de cada critério vêm da configuração (scoringConfig) e
// são aplicadas via evalRanges — editar faixas em /configuracoes altera o
// cálculo de verdade. Pesos, bandas de decisão e parâmetros financeiros
// também são configuráveis.

import { loadConfig, evalRanges, type ScoringConfig, type CriterionConfig } from "./scoringConfig";
// Note: persistence is handled by the caller (Resultado.tsx) via historyService.

export interface ScoreBreakdown {
  category: string;
  maxPoints: number;
  points: number;
  detail: string;
}

export interface ScoringResult {
  id?: string; // uuid da linha em `analises` (preenchido após salvar)
  clienteId?: string | null; // vínculo com o CRM (tabela clientes)
  score: number;
  originalScore?: number;
  manualAdjustment?: { points: number; justification: string; adjustedAt: string };
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

/** Ausente = null/undefined/vazio. `0` e `false` são valores legítimos. */
export const isMissing = (v: any): boolean =>
  v === null || v === undefined || v === "" || v === "NÃO INFORMADO";

/** Price formula: PMT = PV * [i*(1+i)^n] / [(1+i)^n - 1] */
const calcParcela = (pv: number, taxaMensal: number, prazoMeses: number): number => {
  if (pv <= 0 || prazoMeses <= 0) return 0;
  const i = taxaMensal;
  if (i === 0) return pv / prazoMeses;
  const pow = Math.pow(1 + i, prazoMeses);
  return pv * (i * pow) / (pow - 1);
};

/** Decisão pela banda configurada — reutilizada pelo ajuste manual. */
export function decideFromScore(
  score: number,
  insufficientData: boolean,
  config: ScoringConfig = loadConfig(),
): { decision: string; decisionColor: string } {
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

const findCriterion = (list: CriterionConfig[], id: string): CriterionConfig | undefined =>
  list.find((c) => c.id === id);

/** Pontua via faixas configuradas; dado ausente rende 0 pontos com o motivo. */
const scoreCriterion = (
  criterion: CriterionConfig | undefined,
  metric: number | null,
  missingDetail: string,
  formatDetail: (label: string) => string,
): ScoreBreakdown | null => {
  if (!criterion || criterion.maxPoints <= 0) return null;
  if (metric === null) {
    return { category: criterion.name, maxPoints: criterion.maxPoints, points: 0, detail: missingDetail };
  }
  const { points, label } = evalRanges(criterion, metric);
  return { category: criterion.name, maxPoints: criterion.maxPoints, points, detail: formatDetail(label) };
};

// ===================== PF SCORING =====================
export function scorePF(
  extractedData: Record<string, any>,
  valor: number,
  prazo: number,
  finalidade: string,
  clienteId?: string | null,
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

  const rendaMissing = isMissing(extractedData.renda_total_anual);
  const bensAtualMissing = isMissing(extractedData.bens_direitos_total_atual);
  const bensAnteriorMissing = isMissing(extractedData.bens_direitos_total_anterior);
  const dividasMissing = isMissing(extractedData.dividas_onus_total_atual);
  const aliquotaMissing = isMissing(extractedData.aliquota_efetiva_percentual);
  const impostoMissing = isMissing(extractedData.imposto_devido_total);

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

  const push = (b: ScoreBreakdown | null) => { if (b) breakdown.push(b); };

  // 1. Comprometimento de renda — % da renda mensal consumida pela parcela
  {
    const c = findCriterion(config.pfIrpf, "pf_comprometimento");
    const taxa = fp.taxaMensal / 100;
    const parcela = calcParcela(valor, taxa, prazo);
    const metric = rendaMissing || rendaMensal <= 0 ? null : (parcela / rendaMensal) * 100;
    push(scoreCriterion(c, metric, "Renda não informada",
      (label) => `${metric!.toFixed(1)}% da renda mensal (${label})`));
  }

  // 2. Evolução patrimonial — variação de patrimônio como % da renda anual
  {
    const c = findCriterion(config.pfIrpf, "pf_evolucao");
    let metric: number | null = null;
    let missingDetail = "Renda não informada";
    if (!rendaMissing && rendaAnual > 0) {
      if (bensAtualMissing || bensAnteriorMissing) {
        missingDetail = "Patrimônio não informado";
      } else {
        metric = ((bensAtual - bensAnterior) / rendaAnual) * 100;
      }
    }
    push(scoreCriterion(c, metric, missingDetail,
      (label) => `${metric!.toFixed(1)}% (${label})`));
  }

  // 3. Patrimônio vs Renda — bens como % da renda anual (100 = 1x)
  {
    const c = findCriterion(config.pfIrpf, "pf_patrimonio_renda");
    const metric = rendaMissing || rendaAnual <= 0 || bensAtualMissing
      ? null
      : (bensAtual / rendaAnual) * 100;
    push(scoreCriterion(c, metric,
      rendaMissing || rendaAnual <= 0 ? "Renda não informada" : "Patrimônio não informado",
      (label) => `${(metric! / 100).toFixed(2)}x a renda anual (${label})`));
  }

  // 4. Endividamento — dívidas como % do patrimônio; 0 dívidas é legítimo
  {
    const c = findCriterion(config.pfIrpf, "pf_endividamento");
    let metric: number | null = null;
    let missingDetail = "Dívidas não informadas";
    if (!dividasMissing) {
      if (dividasTotal === 0) {
        metric = 0; // cai na faixa "Sem dívidas"
      } else if (bensAtualMissing || bensAtual <= 0) {
        missingDetail = "Dívidas sem patrimônio declarado";
      } else {
        metric = (dividasTotal / bensAtual) * 100;
      }
    }
    push(scoreCriterion(c, metric, missingDetail,
      (label) => metric === 0 ? label : `${metric!.toFixed(1)}% do patrimônio (${label})`));
  }

  // 5. Estabilidade de renda — métrica categórica: 0 única, 1 múltiplas, 2 múltiplas+dividendos
  {
    const c = findCriterion(config.pfIrpf, "pf_estabilidade");
    let metric = 0;
    if (multiplasFontes === true || (numFontes > 1 && dividendos > 0)) metric = 2;
    else if (numFontes > 1) metric = 1;
    else if (rendaAnual > 0 && dividendos > 0) metric = 2;
    push(scoreCriterion(c, metric, "", (label) => label));
  }

  // 6. Posse de bens reais — 0 nenhum, 1 veículo, 2 imóvel, 3 ambos
  {
    const c = findCriterion(config.pfIrpf, "pf_bens_reais");
    const metric = (possuiImovel ? 2 : 0) + (possuiVeiculo ? 1 : 0);
    push(scoreCriterion(c, metric, "", (label) => label));
  }

  // 7. Coerência tributária — isento legítimo (alíquota 0 e imposto 0) é coerente
  {
    const c = findCriterion(config.pfIrpf, "pf_coerencia");
    let metric: number | null = null;
    if (!aliquotaMissing && !impostoMissing) {
      const coerente = (aliquota > 0) === (impostoDevido > 0);
      metric = coerente ? 1 : 0;
    }
    push(scoreCriterion(c, metric, "Dados tributários não informados",
      (label) => aliquota > 0
        ? `Alíquota ${aliquota}% — ${label.toLowerCase()}`
        : impostoDevido === 0 && metric === 1 ? "Isento — coerente" : label));
  }

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = decideFromScore(score, insufficientData, config);

  return {
    clienteId: clienteId ?? null,
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pf",
    extractedData, formData: { valor, prazo, finalidade },
  };
}

// ===================== PJ SCORING =====================
// Criteria IDs for balanço-based vs faturamento-based analysis
const BALANCO_CRITERIA = ["pj_liquidez", "pj_margem", "pj_endividamento", "pj_comprometimento_pl", "pj_pl"];
const FATURAMENTO_CRITERIA = ["pj_evolucao_fat", "pj_regularidade"];

/** Tenta ordenar meses "MM/AAAA", "AAAA-MM" ou "jan/AAAA"; null se irreconhecível. */
const parseMesAno = (s: any): number | null => {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d{1,2})\s*[/-]\s*(\d{4})$/);
  if (m) return parseInt(m[2]) * 12 + (parseInt(m[1]) - 1);
  m = t.match(/^(\d{4})\s*[/-]\s*(\d{1,2})$/);
  if (m) return parseInt(m[1]) * 12 + (parseInt(m[2]) - 1);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  m = t.match(/^([a-zç]{3,})\s*[/-]?\s*(\d{4})$/);
  if (m) {
    const idx = meses.indexOf(m[1].slice(0, 3));
    if (idx >= 0) return parseInt(m[2]) * 12 + idx;
  }
  return null;
};

const sortFatMensal = (fatMensal: any[]): any[] => {
  const keyed = fatMensal.map((item) => ({ item, key: parseMesAno(item?.mes_ano) }));
  // Só reordena se TODOS os meses forem reconhecidos — senão preserva a ordem do documento
  if (keyed.some((k) => k.key === null)) return fatMensal;
  return keyed.sort((a, b) => (a.key! - b.key!)).map((k) => k.item);
};

export function scorePJ(
  extractedData: Record<string, any>,
  valor: number,
  prazo: number,
  finalidade: string,
  clienteId?: string | null,
): ScoringResult {
  const config = loadConfig();
  const fp = config.financialParams;

  const pjDocType: "balancos" | "faturamento" = extractedData.pjDocType || "balancos";

  // Determine which criteria are active based on doc type
  const excludedIds = pjDocType === "balancos" ? FATURAMENTO_CRITERIA : BALANCO_CRITERIA;

  // Redistribution factor: scale active weights so they sum to 1000
  let activeTotal = 0;
  for (const c of config.pj) {
    if (!excludedIds.includes(c.id)) activeTotal += c.maxPoints;
  }
  const redistributionFactor = activeTotal > 0 ? 1000 / activeTotal : 1;

  /** Critério com peso redistribuído; null quando inativo p/ este tipo de doc. */
  const getCriterion = (id: string): CriterionConfig | undefined => {
    if (excludedIds.includes(id)) return undefined;
    const base = findCriterion(config.pj, id);
    if (!base || base.maxPoints <= 0) return undefined;
    return { ...base, maxPoints: Math.round(base.maxPoints * redistributionFactor) };
  };

  const breakdown: ScoreBreakdown[] = [];
  const push = (b: ScoreBreakdown | null) => { if (b) breakdown.push(b); };

  const balancos = extractedData.balancos?.balancos || extractedData.balancos || [];
  const faturamento = extractedData.faturamento || {};
  const lastBalanco = Array.isArray(balancos) && balancos.length > 0 ? balancos[balancos.length - 1] : {};
  const prevBalanco = Array.isArray(balancos) && balancos.length > 1 ? balancos[balancos.length - 2] : null;

  const acMissing = isMissing(lastBalanco.ativo_circulante);
  const pcMissing = isMissing(lastBalanco.passivo_circulante);
  const atMissing = isMissing(lastBalanco.ativo_total);
  const plMissing = isMissing(lastBalanco.patrimonio_liquido);
  const receitaMissing = isMissing(lastBalanco.receita_bruta) && isMissing(lastBalanco.receita_liquida);
  const lucroMissing = isMissing(lastBalanco.lucro_liquido);

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
  const fontesReceita =
    num(extractedData.numero_fontes_receita) ||
    num(extractedData.numero_clientes) ||
    num(faturamento.numero_clientes) ||
    (Array.isArray(faturamento.clientes_principais) ? faturamento.clientes_principais.length : 0) ||
    (Array.isArray(lastBalanco.fontes_receita) ? lastBalanco.fontes_receita.length : 0) ||
    (Array.isArray(extractedData.fontes_receita) ? extractedData.fontes_receita.length : 0);

  // Insuficiência: conta campos-chave AUSENTES (null), não zerados
  const keyMissing = pjDocType === "balancos"
    ? [acMissing, pcMissing, atMissing, plMissing, receitaMissing]
    : [isMissing(faturamento.faturamento_total_12_meses) && isMissing(faturamento.faturamento_total_12m),
       isMissing(faturamento.media_mensal)];
  const missingCount = keyMissing.filter(Boolean).length;
  const insufficientData = missingCount > keyMissing.length * (fp.percentualMinimoExtracoes / 100);

  // 1. Liquidez corrente — AC/PC ×100 (balanço only)
  {
    const c = getCriterion("pj_liquidez");
    if (c) {
      if (acMissing || pcMissing) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Ativo/passivo circulante não informado" });
      } else if (passivoCirculante === 0) {
        // Sem obrigações de curto prazo: melhor liquidez possível (se há ativo)
        if (ativoCirculante > 0) {
          push({ category: c.name, maxPoints: c.maxPoints, points: c.maxPoints, detail: "Sem passivo circulante" });
        } else {
          push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Ativo e passivo circulantes zerados" });
        }
      } else {
        const metric = (ativoCirculante / passivoCirculante) * 100;
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `${(metric / 100).toFixed(2)} (${label})` });
      }
    }
  }

  // 2. Evolução faturamento (faturamento only) — 1º semestre vs 2º, meses ordenados
  {
    const c = getCriterion("pj_evolucao_fat");
    if (c) {
      const fatMensal = Array.isArray(faturamento.faturamento_mensal) ? sortFatMensal(faturamento.faturamento_mensal) : [];
      if (fatMensal.length >= 6) {
        const firstHalf = fatMensal.slice(0, 6).reduce((s: number, m: any) => s + num(m.valor), 0);
        const secondHalf = fatMensal.slice(-6).reduce((s: number, m: any) => s + num(m.valor), 0);
        const metric = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `${metric >= 0 ? "+" : ""}${metric.toFixed(1)}% (${label})` });
      } else {
        push({ category: c.name, maxPoints: c.maxPoints, points: Math.round(c.maxPoints * 0.40), detail: "Base mensal insuficiente para tendência" });
      }
    }
  }

  // 3. Margem lucro — LL/RB (balanço only)
  {
    const c = getCriterion("pj_margem");
    if (c) {
      const rb = receitaBruta || fatTotal;
      if ((receitaMissing && rb <= 0) || rb <= 0) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Receita não informada" });
      } else if (lucroMissing) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Lucro líquido não informado" });
      } else {
        const metric = (lucroLiquido / rb) * 100;
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `${metric.toFixed(1)}% (${label})` });
      }
    }
  }

  // 4. Endividamento — (PC+PNC)/AT ×100 (balanço only)
  {
    const c = getCriterion("pj_endividamento");
    if (c) {
      if (atMissing || ativoTotal <= 0) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Ativo total não informado" });
      } else if (pcMissing && isMissing(lastBalanco.passivo_nao_circulante)) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Passivos não informados" });
      } else {
        const metric = ((passivoCirculante + passivoNaoCirculante) / ativoTotal) * 100;
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `${metric.toFixed(1)}% do ativo (${label})` });
      }
    }
  }

  // 5. Comprometimento crédito/PL (balanço only)
  {
    const c = getCriterion("pj_comprometimento_pl");
    if (c) {
      if (plMissing) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "Patrimônio líquido não informado" });
      } else if (patrimonioLiquido <= 0) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "PL negativo ou zerado" });
      } else {
        const metric = (valor / patrimonioLiquido) * 100;
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `${metric.toFixed(1)}% do PL (${label})` });
      }
    }
  }

  // 6. Regularidade faturamento — CV (faturamento only)
  {
    const c = getCriterion("pj_regularidade");
    if (c) {
      const fatMensal = Array.isArray(faturamento.faturamento_mensal) ? faturamento.faturamento_mensal : [];
      let metric: number | null = null;
      let estimated = false;
      if (cv > 0) {
        metric = cv;
      } else if (fatMensal.length >= 6) {
        const vals = fatMensal.map((m: any) => num(m.valor));
        const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        if (mean > 0) {
          const variance = vals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / vals.length;
          metric = (Math.sqrt(variance) / mean) * 100;
          estimated = true;
        }
      }
      if (metric === null) {
        push({ category: c.name, maxPoints: c.maxPoints, points: Math.round(c.maxPoints * 0.70), detail: "CV não informado" });
      } else {
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `CV${estimated ? " est." : ""} ${metric.toFixed(1)}% (${label})` });
      }
    }
  }

  // 7. Tempo de mercado (always active)
  {
    const c = getCriterion("pj_tempo_mercado");
    if (c) {
      if (tempoMercado > 0) {
        const { points, label } = evalRanges(c, tempoMercado);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: `${tempoMercado} anos (${label})` });
      } else {
        push({ category: c.name, maxPoints: c.maxPoints, points: Math.round(c.maxPoints * 0.40), detail: "Não informado (padrão 3-5 anos)" });
      }
    }
  }

  // 8. PL positivo/crescente (balanço only) — métrica: 0 negativo, 1 em queda, 2 crescente
  {
    const c = getCriterion("pj_pl");
    if (c) {
      if (plMissing) {
        push({ category: c.name, maxPoints: c.maxPoints, points: 0, detail: "PL não informado" });
      } else if (patrimonioLiquido <= 0) {
        const { points, label } = evalRanges(c, 0);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: label });
      } else if (prevBalanco && !isMissing(prevBalanco.patrimonio_liquido)) {
        const metric = patrimonioLiquido > plAnterior ? 2 : 1;
        const { points, label } = evalRanges(c, metric);
        push({ category: c.name, maxPoints: c.maxPoints, points, detail: label });
      } else {
        push({ category: c.name, maxPoints: c.maxPoints, points: Math.round(c.maxPoints * 0.50), detail: "Positivo (sem comparação)" });
      }
    }
  }

  // 9. Diversificação de receitas (always active)
  {
    const c = getCriterion("pj_diversificacao_receitas");
    if (c) {
      const { points, label } = evalRanges(c, fontesReceita);
      const detail = fontesReceita > 0
        ? `${fontesReceita} fontes/clientes relevantes (${label})`
        : "Receita concentrada ou não informada";
      push({ category: c.name, maxPoints: c.maxPoints, points, detail });
    }
  }

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  const { decision, decisionColor } = decideFromScore(score, insufficientData, config);

  return {
    clienteId: clienteId ?? null,
    score, breakdown, decision, decisionColor, insufficientData,
    protocolo: generateProtocolo(), data: new Date().toISOString(), tipo: "pj",
    pjDocType,
    extractedData, formData: { valor, prazo, finalidade },
  };
}
