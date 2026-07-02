import { describe, it, expect, beforeEach } from "vitest";
import { scorePF, scorePJ, decideFromScore, isMissing } from "@/lib/creditScoring";
import { DEFAULT_CONFIG, CONFIG_VERSION, type ScoringConfig } from "@/lib/scoringConfig";

// Fixture PF completa e saudável: renda R$ 300k/ano (25k/mês), patrimônio
// crescente, sem dívidas, isento não — todos os campos presentes.
const pfCompleto = (): Record<string, any> => ({
  renda_total_anual: 300000,
  bens_direitos_total_atual: 400000,
  bens_direitos_total_anterior: 355000, // evolução 15% da renda → faixa "Boa"
  dividas_onus_total_atual: 0,
  possui_imovel: true,
  possui_veiculo: true,
  aliquota_efetiva_percentual: 12,
  imposto_devido_total: 20000,
  multiplas_fontes: true,
  numero_fontes_renda: 2,
  dividendos_recebidos: 10000,
});

// valor 100k, taxa padrão 2% a.m., prazo 24 → parcela ≈ R$ 5.287
const VALOR = 100000;
const PRAZO = 24;

const setSavedConfig = (config: Partial<ScoringConfig>) => {
  localStorage.setItem("scoring_config", JSON.stringify(config));
};

beforeEach(() => {
  localStorage.clear();
});

describe("isMissing — 0 e false são valores legítimos", () => {
  it("trata null/undefined/vazio como ausente", () => {
    expect(isMissing(null)).toBe(true);
    expect(isMissing(undefined)).toBe(true);
    expect(isMissing("")).toBe(true);
    expect(isMissing("NÃO INFORMADO")).toBe(true);
  });
  it("NÃO trata 0 nem false como ausente", () => {
    expect(isMissing(0)).toBe(false);
    expect(isMissing(false)).toBe(false);
  });
});

describe("scorePF — semântica de dados ausentes", () => {
  it("cliente com dados completos não cai em DADOS INSUFICIENTES", () => {
    const r = scorePF(pfCompleto(), VALOR, PRAZO, "");
    expect(r.insufficientData).toBe(false);
    expect(r.decision).not.toContain("INSUFICIENTES");
  });

  it("'sem dívidas' (0 legítimo) pontua o máximo em Endividamento", () => {
    const r = scorePF(pfCompleto(), VALOR, PRAZO, "");
    const endiv = r.breakdown.find((b) => b.category === "Endividamento")!;
    expect(endiv.points).toBe(endiv.maxPoints);
  });

  it("dívidas NÃO informadas (null) rendem 0 pontos, não pontuação máxima", () => {
    const data = { ...pfCompleto(), dividas_onus_total_atual: null };
    const r = scorePF(data, VALOR, PRAZO, "");
    const endiv = r.breakdown.find((b) => b.category === "Endividamento")!;
    expect(endiv.points).toBe(0);
    expect(endiv.detail).toMatch(/não informad/i);
  });

  it("isento de IR legítimo (alíquota 0, imposto 0) é coerente tributariamente", () => {
    const data = { ...pfCompleto(), aliquota_efetiva_percentual: 0, imposto_devido_total: 0 };
    const r = scorePF(data, VALOR, PRAZO, "");
    const trib = r.breakdown.find((b) => b.category === "Coerência Tributária")!;
    expect(trib.points).toBe(trib.maxPoints);
    expect(r.insufficientData).toBe(false);
  });

  it("alíquota positiva com imposto zerado é inconsistente", () => {
    const data = { ...pfCompleto(), aliquota_efetiva_percentual: 5, imposto_devido_total: 0 };
    const r = scorePF(data, VALOR, PRAZO, "");
    const trib = r.breakdown.find((b) => b.category === "Coerência Tributária")!;
    expect(trib.points).toBe(0);
  });

  it("maioria dos campos-chave null → DADOS INSUFICIENTES", () => {
    const data = {
      renda_total_anual: null,
      bens_direitos_total_atual: null,
      bens_direitos_total_anterior: null,
      dividas_onus_total_atual: null,
      possui_imovel: null,
      possui_veiculo: true,
      aliquota_efetiva_percentual: null,
      imposto_devido_total: null,
    };
    const r = scorePF(data, VALOR, PRAZO, "");
    expect(r.insufficientData).toBe(true);
    expect(r.decision).toContain("INSUFICIENTES");
  });
});

describe("scorePF — política de comprometimento de renda (zera > 45%)", () => {
  it("comprometimento ~21% pontua o máximo", () => {
    const r = scorePF(pfCompleto(), VALOR, PRAZO, ""); // 5287/25000 ≈ 21%
    const comp = r.breakdown.find((b) => b.category === "Comprometimento de Renda")!;
    expect(comp.points).toBe(comp.maxPoints);
  });

  it("comprometimento ~47% zera o critério (política 45%, não mais 50%)", () => {
    const data = { ...pfCompleto(), renda_total_anual: 135000 }; // 11.250/mês → ≈47%
    const r = scorePF(data, VALOR, PRAZO, "");
    const comp = r.breakdown.find((b) => b.category === "Comprometimento de Renda")!;
    expect(comp.points).toBe(0);
  });

  it("renda não informada zera o critério com o motivo", () => {
    const data = { ...pfCompleto(), renda_total_anual: null };
    const r = scorePF(data, VALOR, PRAZO, "");
    const comp = r.breakdown.find((b) => b.category === "Comprometimento de Renda")!;
    expect(comp.points).toBe(0);
    expect(comp.detail).toMatch(/renda não informada/i);
  });
});

describe("scorePF — faixas configuradas são aplicadas de verdade", () => {
  it("faixa customizada (versão atual) muda o resultado do cálculo", () => {
    const custom = structuredClone(DEFAULT_CONFIG);
    const comp = custom.pfIrpf.find((c) => c.id === "pf_comprometimento")!;
    comp.ranges = [
      { label: "Excelente", min: 0, max: 10, percentage: 100 },
      { label: "Crítico", min: 10, max: 100, percentage: 0 },
    ];
    setSavedConfig({ ...custom, configVersion: CONFIG_VERSION });

    const r = scorePF(pfCompleto(), VALOR, PRAZO, ""); // ≈21% → crítico na faixa custom
    const b = r.breakdown.find((x) => x.category === "Comprometimento de Renda")!;
    expect(b.points).toBe(0);
  });

  it("faixas de config LEGADA (sem versão) são descartadas — política antiga de 50% não reativa", () => {
    const legacy = structuredClone(DEFAULT_CONFIG) as Partial<ScoringConfig>;
    delete legacy.configVersion;
    const comp = legacy.pfIrpf!.find((c) => c.id === "pf_comprometimento")!;
    comp.ranges = [
      { label: "Excelente", min: 0, max: 25, percentage: 100 },
      { label: "Bom", min: 25, max: 35, percentage: 72 },
      { label: "Regular", min: 35, max: 50, percentage: 36 },
      { label: "Crítico", min: 50, max: 100, percentage: 0 },
    ];
    setSavedConfig(legacy);

    const data = { ...pfCompleto(), renda_total_anual: 135000 }; // ≈47%
    const r = scorePF(data, VALOR, PRAZO, "");
    const b = r.breakdown.find((x) => x.category === "Comprometimento de Renda")!;
    // Com a faixa legada valeria 36% do peso; com a política atual (45%) zera.
    expect(b.points).toBe(0);
  });

  it("pesos configurados continuam respeitados", () => {
    const custom = structuredClone(DEFAULT_CONFIG);
    custom.pfIrpf.find((c) => c.id === "pf_comprometimento")!.maxPoints = 300;
    custom.pfIrpf.find((c) => c.id === "pf_evolucao")!.maxPoints = 150;
    setSavedConfig({ ...custom, configVersion: CONFIG_VERSION });

    const r = scorePF(pfCompleto(), VALOR, PRAZO, "");
    const comp = r.breakdown.find((x) => x.category === "Comprometimento de Renda")!;
    expect(comp.maxPoints).toBe(300);
    expect(comp.points).toBe(300);
  });
});

describe("scorePF — critérios customizados não roubam teto do score", () => {
  it("custom criteria salvos não alteram a pontuação dos critérios padrão", () => {
    const custom = structuredClone(DEFAULT_CONFIG);
    custom.customCriteria = [{
      id: "custom_1", name: "Bureau", maxPoints: 200, calcType: "boolean",
      applicableTo: ["pfIrpf"], referenceField: "serasa",
      ranges: [{ label: "Não", min: 0, max: 1, percentage: 0 }, { label: "Sim", min: 1, max: 2, percentage: 100 }],
    }];
    setSavedConfig({ ...custom, configVersion: CONFIG_VERSION });

    const r = scorePF(pfCompleto(), VALOR, PRAZO, "");
    const maxTotal = r.breakdown.reduce((s, b) => s + b.maxPoints, 0);
    expect(maxTotal).toBe(1000); // teto permanece 1000 com os critérios padrão
  });
});

// ============ PJ ============

const balancoSaudavel = (): Record<string, any> => ({
  pjDocType: "balancos",
  balancos: {
    razao_social: "Empresa Teste LTDA",
    cnpj: "11222333000181",
    tempo_mercado_anos: 8,
    balancos: [
      {
        ano_exercicio: "2024",
        ativo_total: 900000, ativo_circulante: 350000,
        passivo_circulante: 180000, passivo_nao_circulante: 90000,
        patrimonio_liquido: 450000, receita_bruta: 700000, lucro_liquido: 70000,
      },
      {
        ano_exercicio: "2025",
        ativo_total: 1000000, ativo_circulante: 400000,
        passivo_circulante: 200000, passivo_nao_circulante: 100000,
        patrimonio_liquido: 500000, receita_bruta: 800000, lucro_liquido: 80000,
      },
    ],
  },
});

describe("scorePJ — balanços", () => {
  it("redistribui pesos: soma dos máximos ativos ≈ 1000", () => {
    const r = scorePJ(balancoSaudavel(), VALOR, PRAZO, "");
    const maxTotal = r.breakdown.reduce((s, b) => s + b.maxPoints, 0);
    expect(maxTotal).toBeGreaterThanOrEqual(995);
    expect(maxTotal).toBeLessThanOrEqual(1005);
  });

  it("empresa sem passivo circulante tem a MELHOR liquidez, não a pior", () => {
    const data = balancoSaudavel();
    data.balancos.balancos[1].passivo_circulante = 0;
    const r = scorePJ(data, VALOR, PRAZO, "");
    const liq = r.breakdown.find((b) => b.category === "Liquidez Corrente")!;
    expect(liq.points).toBe(liq.maxPoints);
    expect(liq.detail).toMatch(/sem passivo circulante/i);
  });

  it("receita não informada zera margem com o motivo (não 'Negativa')", () => {
    const data = balancoSaudavel();
    data.balancos.balancos[1].receita_bruta = null;
    data.balancos.balancos[1].receita_liquida = null;
    const r = scorePJ(data, VALOR, PRAZO, "");
    const m = r.breakdown.find((b) => b.category === "Margem de Lucro")!;
    expect(m.points).toBe(0);
    expect(m.detail).toMatch(/receita não informada/i);
  });

  it("endividamento acima de 70% do ativo zera o critério (política 70%, não 80%)", () => {
    const data = balancoSaudavel();
    data.balancos.balancos[1].passivo_circulante = 500000;
    data.balancos.balancos[1].passivo_nao_circulante = 250000; // 75% do ativo
    const r = scorePJ(data, VALOR, PRAZO, "");
    const e = r.breakdown.find((b) => b.category === "Endividamento")!;
    expect(e.points).toBe(0);
  });

  it("endividamento em 65% cai na faixa 'Alto' (27% do peso)", () => {
    const data = balancoSaudavel();
    data.balancos.balancos[1].passivo_circulante = 400000;
    data.balancos.balancos[1].passivo_nao_circulante = 250000; // 65%
    const r = scorePJ(data, VALOR, PRAZO, "");
    const e = r.breakdown.find((b) => b.category === "Endividamento")!;
    expect(e.points).toBe(Math.round(e.maxPoints * 0.27));
  });

  it("PL não informado zera Comprometimento Crédito/PL com o motivo", () => {
    const data = balancoSaudavel();
    data.balancos.balancos[1].patrimonio_liquido = null;
    const r = scorePJ(data, VALOR, PRAZO, "");
    const c = r.breakdown.find((b) => b.category === "Comprometimento Crédito/PL")!;
    expect(c.points).toBe(0);
    expect(c.detail).toMatch(/não informado/i);
  });

  it("balanço com campos-chave null → DADOS INSUFICIENTES", () => {
    const data = {
      pjDocType: "balancos",
      balancos: {
        balancos: [{
          ativo_total: null, ativo_circulante: null,
          passivo_circulante: null, patrimonio_liquido: null, receita_bruta: null,
        }],
      },
    };
    const r = scorePJ(data, VALOR, PRAZO, "");
    expect(r.insufficientData).toBe(true);
    expect(r.decision).toContain("INSUFICIENTES");
  });
});

describe("scorePJ — faturamento", () => {
  const mkMes = (mes: number, valor: number) => ({
    mes_ano: `${String(mes).padStart(2, "0")}/2025`, valor,
  });

  it("meses fora de ordem são reordenados antes de medir crescimento", () => {
    // 1º semestre 100/mês, 2º semestre 120/mês → +20%; entregue embaralhado
    const meses = [7, 1, 12, 3, 9, 5, 11, 2, 8, 4, 10, 6].map((m) =>
      mkMes(m, m <= 6 ? 100 : 120),
    );
    const data = {
      pjDocType: "faturamento",
      faturamento: {
        faturamento_mensal: meses,
        faturamento_total_12_meses: 1320,
        media_mensal: 110,
        coeficiente_variacao_percentual: 9,
      },
    };
    const r = scorePJ(data, VALOR, PRAZO, "");
    const ev = r.breakdown.find((b) => b.category === "Evolução Faturamento")!;
    expect(ev.detail).toMatch(/\+20\.0%/);
    expect(ev.points).toBe(ev.maxPoints); // >10% = crescimento forte
  });
});

describe("decideFromScore — bandas de decisão", () => {
  it("mapeia score para a banda correta", () => {
    expect(decideFromScore(800, false).decision).toBe("CRÉDITO APROVADO");
    expect(decideFromScore(600, false).decision).toBe("APROVADO COM RESSALVAS");
    expect(decideFromScore(400, false).decision).toBe("CRÉDITO REPROVADO");
    expect(decideFromScore(100, false).decision).toBe("CRÉDITO REPROVADO — RISCO ELEVADO");
  });
  it("dados insuficientes vencem qualquer score", () => {
    expect(decideFromScore(900, true).decision).toContain("INSUFICIENTES");
  });
});

describe("protocolo", () => {
  it("segue o formato AC-XXXXXX", () => {
    const r = scorePF(pfCompleto(), VALOR, PRAZO, "");
    expect(r.protocolo).toMatch(/^AC-[A-Z0-9]{6}$/);
  });
});
