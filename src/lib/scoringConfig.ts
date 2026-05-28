// Scoring Configuration System — manages all adjustable parameters

export interface CriterionRange {
  label: string;
  min: number;
  max: number;
  percentage: number; // % of maxPoints
}

export interface CriterionConfig {
  id: string;
  name: string;
  maxPoints: number;
  ranges: CriterionRange[];
}

export interface CustomCriterion extends CriterionConfig {
  calcType: "boolean" | "ranges";
  applicableTo: ("pfIrpf" | "pj")[];
  referenceField: string;
}

export interface DecisionBand {
  label: string;
  min: number;
  max: number;
  color: string;
}

export interface FinancialParams {
  taxaMensal: number;
  prazoPadrao: number;
  penalizacaoCamposAusentes: number;
  percentualMinimoExtracoes: number;
}

export interface RegraLimite {
  scoreMin: number;
  scoreMax: number;
  percentual: number;
  parcelasMax: number;
}

export interface ScoringConfig {
  descricao?: string;
  pfIrpf: CriterionConfig[];
  pj: CriterionConfig[];
  decisionBands: DecisionBand[];
  financialParams: FinancialParams;
  customCriteria: CustomCriterion[];
  corteFiadorPf: number;
  corteFiadorPj: number;
  validadeAnaliseDias: number;
  regrasLimite: RegraLimite[];
}

const STORAGE_KEY = "scoring_config";
const PASSWORD_KEY = "admin_password";

export const DEFAULT_CONFIG: ScoringConfig = {
  pfIrpf: [
    {
      id: "pf_comprometimento", name: "Comprometimento de Renda", maxPoints: 250,
      ranges: [
        { label: "Excelente", min: 0, max: 25, percentage: 100 },
        { label: "Bom", min: 25, max: 35, percentage: 72 },
        { label: "Regular", min: 35, max: 50, percentage: 36 },
        { label: "Crítico", min: 50, max: 100, percentage: 0 },
      ],
    },
    {
      id: "pf_evolucao", name: "Evolução Patrimonial", maxPoints: 200,
      ranges: [
        { label: "Negativa", min: -100, max: 0, percentage: 0 },
        { label: "Baixa", min: 0, max: 5, percentage: 10 },
        { label: "Moderada", min: 5, max: 10, percentage: 40 },
        { label: "Boa", min: 10, max: 20, percentage: 75 },
        { label: "Excelente", min: 20, max: 100, percentage: 100 },
      ],
    },
    {
      id: "pf_patrimonio_renda", name: "Patrimônio vs Renda", maxPoints: 150,
      ranges: [
        { label: "Crítico", min: 0, max: 50, percentage: 7 },
        { label: "Baixo", min: 50, max: 100, percentage: 33 },
        { label: "Adequado", min: 100, max: 200, percentage: 67 },
        { label: "Excelente", min: 200, max: 1000, percentage: 100 },
      ],
    },
    {
      id: "pf_endividamento", name: "Endividamento", maxPoints: 150,
      ranges: [
        { label: "Sem dívidas", min: 0, max: 0.1, percentage: 100 },
        { label: "Baixo", min: 0.1, max: 30, percentage: 67 },
        { label: "Moderado", min: 30, max: 60, percentage: 33 },
        { label: "Alto", min: 60, max: 100, percentage: 0 },
      ],
    },
    {
      id: "pf_estabilidade", name: "Estabilidade de Renda", maxPoints: 100,
      ranges: [
        { label: "Fonte única", min: 0, max: 1, percentage: 60 },
        { label: "Múltiplas fontes", min: 1, max: 2, percentage: 80 },
        { label: "Múltiplas + dividendos", min: 2, max: 100, percentage: 100 },
      ],
    },
    {
      id: "pf_bens_reais", name: "Posse de Bens Reais", maxPoints: 100,
      ranges: [
        { label: "Nenhum", min: 0, max: 1, percentage: 0 },
        { label: "Veículo", min: 1, max: 2, percentage: 40 },
        { label: "Imóvel", min: 2, max: 3, percentage: 60 },
        { label: "Imóvel + Veículo", min: 3, max: 4, percentage: 100 },
      ],
    },
    {
      id: "pf_coerencia", name: "Coerência Tributária", maxPoints: 50,
      ranges: [
        { label: "Inconsistente", min: 0, max: 1, percentage: 0 },
        { label: "Coerente", min: 1, max: 2, percentage: 100 },
      ],
    },
  ],
  pj: [
    {
      id: "pj_liquidez", name: "Liquidez Corrente", maxPoints: 150,
      ranges: [
        { label: "Crítica", min: 0, max: 100, percentage: 0 },
        { label: "Ajustada", min: 100, max: 120, percentage: 47 },
        { label: "Boa", min: 120, max: 150, percentage: 80 },
        { label: "Excelente", min: 150, max: 1000, percentage: 100 },
      ],
    },
    {
      id: "pj_evolucao_fat", name: "Evolução Faturamento", maxPoints: 150,
      ranges: [
        { label: "Queda", min: -100, max: 0, percentage: 0 },
        { label: "Estável", min: 0, max: 0.1, percentage: 40 },
        { label: "Crescimento moderado", min: 0.1, max: 10, percentage: 67 },
        { label: "Crescimento forte", min: 10, max: 100, percentage: 100 },
      ],
    },
    {
      id: "pj_margem", name: "Margem de Lucro", maxPoints: 150,
      ranges: [
        { label: "Negativa", min: -100, max: 0, percentage: 0 },
        { label: "Muito baixa", min: 0, max: 3, percentage: 13 },
        { label: "Baixa", min: 3, max: 8, percentage: 40 },
        { label: "Boa", min: 8, max: 15, percentage: 73 },
        { label: "Excelente", min: 15, max: 100, percentage: 100 },
      ],
    },
    {
      id: "pj_endividamento", name: "Endividamento", maxPoints: 150,
      ranges: [
        { label: "Baixo", min: 0, max: 40, percentage: 100 },
        { label: "Moderado", min: 40, max: 60, percentage: 67 },
        { label: "Alto", min: 60, max: 80, percentage: 27 },
        { label: "Crítico", min: 80, max: 100, percentage: 0 },
      ],
    },
    {
      id: "pj_comprometimento_pl", name: "Comprometimento Crédito/PL", maxPoints: 100,
      ranges: [
        { label: "Baixo", min: 0, max: 30, percentage: 100 },
        { label: "Moderado", min: 30, max: 60, percentage: 60 },
        { label: "Alto", min: 60, max: 100, percentage: 20 },
        { label: "Crítico", min: 100, max: 1000, percentage: 0 },
      ],
    },
    {
      id: "pj_regularidade", name: "Regularidade Faturamento", maxPoints: 100,
      ranges: [
        { label: "Regular", min: 0, max: 15, percentage: 100 },
        { label: "Moderada", min: 15, max: 30, percentage: 70 },
        { label: "Irregular", min: 30, max: 50, percentage: 30 },
        { label: "Muito irregular", min: 50, max: 100, percentage: 0 },
      ],
    },
    {
      id: "pj_tempo_mercado", name: "Tempo de Mercado", maxPoints: 100,
      ranges: [
        { label: "<1 ano", min: 0, max: 1, percentage: 0 },
        { label: "1-3 anos", min: 1, max: 3, percentage: 20 },
        { label: "3-5 anos", min: 3, max: 5, percentage: 40 },
        { label: "5-10 anos", min: 5, max: 10, percentage: 70 },
        { label: ">10 anos", min: 10, max: 100, percentage: 100 },
      ],
    },
    {
      id: "pj_pl", name: "PL Positivo/Crescente", maxPoints: 50,
      ranges: [
        { label: "Negativo", min: 0, max: 1, percentage: 0 },
        { label: "Positivo em queda", min: 1, max: 2, percentage: 50 },
        { label: "Positivo e crescente", min: 2, max: 3, percentage: 100 },
      ],
    },
    {
      id: "pj_diversificacao_receitas", name: "Diversificação de Receitas", maxPoints: 50,
      ranges: [
        { label: "Concentrada", min: 0, max: 2, percentage: 20 },
        { label: "Moderada", min: 2, max: 4, percentage: 60 },
        { label: "Diversificada", min: 4, max: 100, percentage: 100 },
      ],
    },
  ],
  decisionBands: [
    { label: "CRÉDITO APROVADO", min: 750, max: 1000, color: "#16a34a" },
    { label: "APROVADO COM RESSALVAS", min: 500, max: 749, color: "#ea580c" },
    { label: "CRÉDITO REPROVADO", min: 0, max: 499, color: "#dc2626" },
  ],
  financialParams: {
    taxaMensal: 2.0,
    prazoPadrao: 24,
    penalizacaoCamposAusentes: -100,
    percentualMinimoExtracoes: 50,
  },
  customCriteria: [],
  corteFiadorPf: 600,
  corteFiadorPj: 700,
  validadeAnaliseDias: 90,
  regrasLimite: [
    { scoreMin: 900, scoreMax: 1000, percentual: 100, parcelasMax: 48 },
    { scoreMin: 800, scoreMax: 899, percentual: 80, parcelasMax: 36 },
    { scoreMin: 700, scoreMax: 799, percentual: 60, parcelasMax: 24 },
    { scoreMin: 600, scoreMax: 699, percentual: 40, parcelasMax: 12 },
    { scoreMin: 0, scoreMax: 599, percentual: 0, parcelasMax: 0 },
  ],
};

const mergeCriteria = (defaults: CriterionConfig[], saved?: CriterionConfig[]) => {
  if (!Array.isArray(saved)) return structuredClone(defaults);
  const savedById = new Map(saved.map((c) => [c.id, c]));
  const merged = defaults.map((def) => ({ ...def, ...(savedById.get(def.id) || {}) }));
  const customSaved = saved.filter((c) => !defaults.some((def) => def.id === c.id));
  return [...merged, ...customSaved];
};

const normalizeConfig = (parsed: Partial<ScoringConfig>): ScoringConfig => ({
  ...DEFAULT_CONFIG,
  ...parsed,
  pfIrpf: mergeCriteria(DEFAULT_CONFIG.pfIrpf, parsed.pfIrpf),
  pj: mergeCriteria(DEFAULT_CONFIG.pj, parsed.pj),
  decisionBands: parsed.decisionBands || structuredClone(DEFAULT_CONFIG.decisionBands),
  financialParams: { ...DEFAULT_CONFIG.financialParams, ...(parsed.financialParams || {}) },
  customCriteria: (parsed.customCriteria || []).map((c) => ({
    ...c,
    applicableTo: (c.applicableTo as readonly string[]).filter(
      (k) => k === "pfIrpf" || k === "pj",
    ) as ("pfIrpf" | "pj")[],
  })),
  corteFiadorPf: typeof parsed.corteFiadorPf === "number" ? parsed.corteFiadorPf : DEFAULT_CONFIG.corteFiadorPf,
  corteFiadorPj: typeof parsed.corteFiadorPj === "number" ? parsed.corteFiadorPj : DEFAULT_CONFIG.corteFiadorPj,
  validadeAnaliseDias: typeof parsed.validadeAnaliseDias === "number" ? parsed.validadeAnaliseDias : DEFAULT_CONFIG.validadeAnaliseDias,
  regrasLimite:
    Array.isArray(parsed.regrasLimite) && parsed.regrasLimite.length > 0
      ? parsed.regrasLimite
      : structuredClone(DEFAULT_CONFIG.regrasLimite),
});

export function loadConfig(): ScoringConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeConfig(parsed);
    }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_CONFIG);
}

export function saveConfig(config: ScoringConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportConfig(config: ScoringConfig): void {
  const payload = { descricao: config.descricao || "Preset de pontuação POSSIBLE", ...config };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `config-possible-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfig(file: File): Promise<ScoringConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.pfIrpf && parsed.pj && parsed.decisionBands) {
          resolve(normalizeConfig(parsed));
        } else {
          reject(new Error("Formato de configuração inválido"));
        }
      } catch { reject(new Error("JSON inválido")); }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}

export function getAdminPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || "12345678";
}

export function setAdminPassword(pwd: string): void {
  localStorage.setItem(PASSWORD_KEY, pwd);
}

export function isConfigAuthenticated(): boolean {
  return sessionStorage.getItem("config_auth") === "true";
}

export function setConfigAuthenticated(v: boolean): void {
  if (v) sessionStorage.setItem("config_auth", "true");
  else sessionStorage.removeItem("config_auth");
}

/** Find matching range for a metric value and return points */
export function applyRanges(metricValue: number, criterion: CriterionConfig): number {
  for (const range of criterion.ranges) {
    if (metricValue >= range.min && metricValue < range.max) {
      return Math.round(criterion.maxPoints * range.percentage / 100);
    }
  }
  // Check last range inclusively
  const last = criterion.ranges[criterion.ranges.length - 1];
  if (last && metricValue >= last.min && metricValue <= last.max) {
    return Math.round(criterion.maxPoints * last.percentage / 100);
  }
  return 0;
}

/** Validate ranges have no gaps */
export function validateRanges(ranges: CriterionRange[]): string | null {
  if (ranges.length === 0) return "Nenhuma faixa definida";
  const sorted = [...ranges].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min > sorted[i - 1].max) {
      return `Gap detectado entre ${sorted[i - 1].max}% e ${sorted[i].min}%. Ajuste as faixas para cobertura contínua.`;
    }
    if (sorted[i].min < sorted[i - 1].max) {
      return `Sobreposição detectada entre ${sorted[i].min}% e ${sorted[i - 1].max}%.`;
    }
  }
  return null;
}

/** Validate decision bands cover 0-1000 */
export function validateDecisionBands(bands: DecisionBand[]): string | null {
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (sorted[0]?.min !== 0) return "A faixa mínima deve começar em 0.";
  if (sorted[sorted.length - 1]?.max !== 1000) return "A faixa máxima deve terminar em 1000.";
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min !== sorted[i - 1].max + 1) {
      return `Gap ou sobreposição entre ${sorted[i - 1].max} e ${sorted[i].min}.`;
    }
  }
  return null;
}
