import { useState, useRef, useMemo, useEffect } from "react";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Plus, Trash2, Download, Upload, RotateCcw, Save, AlertTriangle, HelpCircle, Pencil,
} from "lucide-react";
import {
  ScoringConfig, CriterionConfig, CustomCriterion, DecisionBand,
  DEFAULT_CONFIG, exportConfig, importConfig,
  validateRanges, validateDecisionBands,
} from "@/lib/scoringConfig";
import { getScoringConfig, saveScoringConfig, migrateLocalConfigIfNeeded } from "@/lib/scoringConfigService";
import BackButton from "@/components/BackButton";
import { Loader2 } from "lucide-react";

const CRITERION_HELP: Record<string, string> = {
  "Comprometimento de Renda": "Avalia quanto a parcela estimada consome da renda mensal identificada nos documentos.",
  "Evolução Patrimonial": "Compara a variação do patrimônio declarado com a renda anual informada.",
  "Patrimônio vs Renda": "Mede a relação entre bens declarados e renda anual para avaliar lastro financeiro.",
  "Endividamento": "Analisa dívidas em relação ao patrimônio ou ativos disponíveis.",
  "Estabilidade de Renda": "Verifica quantidade e qualidade das fontes de renda extraídas.",
  "Posse de Bens Reais": "Pontua a presença de bens como imóvel e veículo nos documentos.",
  "Coerência Tributária": "Confere se imposto, alíquota e renda declarada são consistentes.",
  "Liquidez Corrente": "Calcula ativo circulante dividido pelo passivo circulante nos balanços.",
  "Evolução Faturamento": "Compara o faturamento recente com períodos anteriores para medir crescimento.",
  "Margem de Lucro": "Calcula lucro líquido sobre receita para avaliar rentabilidade.",
  "Comprometimento Crédito/PL": "Mede o crédito solicitado em relação ao patrimônio líquido da empresa.",
  "Regularidade Faturamento": "Avalia a estabilidade mensal do faturamento pelo coeficiente de variação.",
  "Tempo de Mercado": "Pontua empresas com maior histórico operacional.",
  "PL Positivo/Crescente": "Verifica se o patrimônio líquido é positivo e evolui entre balanços.",
  "Diversificação de Receitas": "Avalia se a receita depende de poucos clientes/fontes ou é distribuída.",
};

// ─── Criteria Editor (weights + expandable ranges) ──────
function CriteriaEditor({
  criteria, onChange, customCriteria, onChangeCustom,
  tabKey,
}: {
  criteria: CriterionConfig[];
  onChange: (c: CriterionConfig[]) => void;
  customCriteria: CustomCriterion[];
  onChangeCustom: (c: CustomCriterion[]) => void;
  tabKey: "pfIrpf" | "pj";
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const total = criteria.reduce((s, c) => s + c.maxPoints, 0)
    + customCriteria.filter(cc => cc.applicableTo.includes(tabKey)).reduce((s, c) => s + c.maxPoints, 0);

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const updateWeight = (idx: number, val: number) => {
    const next = [...criteria];
    next[idx] = { ...next[idx], maxPoints: val };
    onChange(next);
  };

  const updateRange = (critIdx: number, rangeIdx: number, field: string, val: number) => {
    const next = [...criteria];
    const ranges = [...next[critIdx].ranges];
    ranges[rangeIdx] = { ...ranges[rangeIdx], [field]: val };
    next[critIdx] = { ...next[critIdx], ranges };
    onChange(next);
  };

  const applicableCustom = customCriteria.filter(cc => cc.applicableTo.includes(tabKey));

  return (
    <div className="space-y-3">
      {/* Standard criteria */}
      {criteria.map((c, ci) => {
        const isOpen = expanded[c.id];
        const rangeError = validateRanges(c.ranges);
        return (
          <div key={c.id} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex flex-1 items-center gap-2 text-sm font-medium text-foreground">
                {c.name}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {CRITERION_HELP[c.name] || "Critério calculado a partir dos dados extraídos dos documentos enviados."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <Input
                type="number" min={0} max={1000}
                className="w-24 text-center"
                value={c.maxPoints}
                onChange={(e) => updateWeight(ci, parseInt(e.target.value) || 0)}
              />
              <Button variant="ghost" size="sm" onClick={() => toggleExpand(c.id)}>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="ml-1 text-xs">Faixas</span>
              </Button>
            </div>
            {isOpen && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left pb-2">Faixa</th>
                      <th className="text-center pb-2">De</th>
                      <th className="text-center pb-2">Até</th>
                      <th className="text-center pb-2">% do peso</th>
                      <th className="text-center pb-2">Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.ranges.map((r, ri) => (
                      <tr key={ri} className="border-t border-border/50">
                        <td className="py-2 text-foreground">{r.label}</td>
                        <td className="py-2 text-center">
                          <Input type="number" className="w-16 text-center text-xs mx-auto" value={r.min}
                            onChange={(e) => updateRange(ci, ri, "min", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="py-2 text-center">
                          <Input type="number" className="w-16 text-center text-xs mx-auto" value={r.max}
                            onChange={(e) => updateRange(ci, ri, "max", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="py-2 text-center">
                          <Input type="number" min={0} max={100} className="w-16 text-center text-xs mx-auto" value={r.percentage}
                            onChange={(e) => updateRange(ci, ri, "percentage", parseInt(e.target.value) || 0)} />
                        </td>
                        <td className="py-2 text-center font-medium text-foreground">
                          {Math.round(c.maxPoints * r.percentage / 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rangeError && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> {rangeError}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom criteria applicable to this tab */}
      {applicableCustom.map((cc) => {
        const isOpen = expanded[cc.id];
        return (
          <div key={cc.id} className="rounded-lg border border-dashed border-primary/40 bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <Badge variant="outline" className="text-xs">Custom</Badge>
              <span className="flex flex-1 items-center gap-2 text-sm font-medium text-foreground">
                {cc.name}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Critério customizado calculado a partir do campo: {cc.referenceField || "referência não definida"}.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <Input
                type="number" min={0} max={1000} className="w-24 text-center"
                value={cc.maxPoints}
                onChange={(e) => {
                  const next = customCriteria.map(c => c.id === cc.id ? { ...c, maxPoints: parseInt(e.target.value) || 0 } : c);
                  onChangeCustom(next);
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => toggleExpand(cc.id)}>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive"
                onClick={() => onChangeCustom(customCriteria.filter(c => c.id !== cc.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {isOpen && cc.calcType === "ranges" && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground">
                    <th className="text-left pb-2">Faixa</th><th className="text-center pb-2">De</th>
                    <th className="text-center pb-2">Até</th><th className="text-center pb-2">% do peso</th>
                    <th className="text-center pb-2">Pontos</th>
                  </tr></thead>
                  <tbody>
                    {cc.ranges.map((r, ri) => (
                      <tr key={ri} className="border-t border-border/50">
                        <td className="py-2">{r.label}</td>
                        <td className="py-2 text-center">
                          <Input type="number" className="w-16 text-center text-xs mx-auto" value={r.min}
                            onChange={(e) => {
                              const next = customCriteria.map(c => {
                                if (c.id !== cc.id) return c;
                                const ranges = [...c.ranges];
                                ranges[ri] = { ...ranges[ri], min: parseFloat(e.target.value) || 0 };
                                return { ...c, ranges };
                              });
                              onChangeCustom(next);
                            }} />
                        </td>
                        <td className="py-2 text-center">
                          <Input type="number" className="w-16 text-center text-xs mx-auto" value={r.max}
                            onChange={(e) => {
                              const next = customCriteria.map(c => {
                                if (c.id !== cc.id) return c;
                                const ranges = [...c.ranges];
                                ranges[ri] = { ...ranges[ri], max: parseFloat(e.target.value) || 0 };
                                return { ...c, ranges };
                              });
                              onChangeCustom(next);
                            }} />
                        </td>
                        <td className="py-2 text-center">
                          <Input type="number" min={0} max={100} className="w-16 text-center text-xs mx-auto" value={r.percentage}
                            onChange={(e) => {
                              const next = customCriteria.map(c => {
                                if (c.id !== cc.id) return c;
                                const ranges = [...c.ranges];
                                ranges[ri] = { ...ranges[ri], percentage: parseInt(e.target.value) || 0 };
                                return { ...c, ranges };
                              });
                              onChangeCustom(next);
                            }} />
                        </td>
                        <td className="py-2 text-center font-medium">{Math.round(cc.maxPoints * r.percentage / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isOpen && cc.calcType === "boolean" && (
              <div className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Sim = {cc.maxPoints} pts | Não = 0 pts
              </div>
            )}
          </div>
        );
      })}

      {/* Total */}
      <div className={`flex items-center justify-between rounded-lg px-4 py-3 font-semibold ${total === 1000 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        <span>TOTAL</span>
        <span className="flex items-center gap-2">
          {total}
          {total === 1000 ? " ✅" : (
            <span className="flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" /> A soma dos pesos é {total}. O total deve ser 1000.
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Add Custom Criterion Dialog ────────────────
function AddCustomDialog({
  open, onOpenChange, onAdd, editCriterion,
}: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (c: CustomCriterion) => void; editCriterion?: CustomCriterion | null }) {
  const [name, setName] = useState("");
  const [maxPoints, setMaxPoints] = useState(50);
  const [calcType, setCalcType] = useState<"boolean" | "ranges">("boolean");
  const [applicableTo, setApplicableTo] = useState<("pfIrpf" | "pj")[]>(["pfIrpf"]);
  const [referenceField, setReferenceField] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editCriterion?.name || "");
    setMaxPoints(editCriterion?.maxPoints || 50);
    setCalcType(editCriterion?.calcType || "boolean");
    setApplicableTo(editCriterion?.applicableTo || ["pfIrpf"]);
    setReferenceField(editCriterion?.referenceField || "");
  }, [open, editCriterion]);

  const handleAdd = () => {
    if (!name.trim()) return;
    const id = editCriterion?.id || `custom_${Date.now()}`;
    const ranges: CustomCriterion["ranges"] = calcType === "boolean"
      ? [{ label: "Não", min: 0, max: 1, percentage: 0 }, { label: "Sim", min: 1, max: 2, percentage: 100 }]
      : [
        { label: "Baixo", min: 0, max: 33, percentage: 0 },
        { label: "Médio", min: 33, max: 66, percentage: 50 },
        { label: "Alto", min: 66, max: 100, percentage: 100 },
      ];
    onAdd({ id, name: name.trim(), maxPoints, ranges: editCriterion?.ranges || ranges, calcType, applicableTo, referenceField });
    setName(""); setMaxPoints(50); setCalcType("boolean"); setApplicableTo(["pfIrpf"]); setReferenceField("");
    onOpenChange(false);
  };

  const toggleApplicable = (key: "pfIrpf" | "pj") => {
    setApplicableTo(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editCriterion ? "Editar Critério Customizado" : "Adicionar Critério Customizado"}</DialogTitle>
          <DialogDescription>Critérios customizados dependem de dados que a IA consiga extrair dos documentos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome do critério</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Histórico de inadimplência" />
          </div>
          <div>
            <label className="text-sm font-medium">Peso máximo</label>
            <Input type="number" min={1} max={500} value={maxPoints} onChange={(e) => setMaxPoints(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo de cálculo</label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={calcType} onChange={(e) => setCalcType(e.target.value as any)}>
              <option value="boolean">Sim/Não</option>
              <option value="ranges">Faixas de valor</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Aplicável a</label>
            <div className="flex gap-3 mt-1">
              {(["pfIrpf", "pj"] as const).map(k => (
                <label key={k} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={applicableTo.includes(k)}
                    onChange={() => toggleApplicable(k)} className="rounded" />
                  {k === "pfIrpf" ? "PF IRPF" : "PJ"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Campo de referência</label>
            <Input value={referenceField} onChange={(e) => setReferenceField(e.target.value)}
              placeholder="Descreva qual dado da extração usar" />
          </div>
          <Button onClick={handleAdd} disabled={!name.trim()} className="w-full">{editCriterion ? "Salvar alterações" : "Adicionar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────
export default function Configuracoes() {
  const [config, setConfig] = useState<ScoringConfig>(() => structuredClone(DEFAULT_CONFIG));
  const [savedConfig, setSavedConfig] = useState<string>(() => JSON.stringify(DEFAULT_CONFIG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addCustomOpen, setAddCustomOpen] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CustomCriterion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await migrateLocalConfigIfNeeded();
        const loaded = await getScoringConfig();
        if (!alive) return;
        setConfig(loaded);
        setSavedConfig(JSON.stringify(loaded));
      } catch (err: any) {
        toast.error(err.message || "Erro ao carregar configurações.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const hasChanges = useMemo(() => JSON.stringify(config) !== savedConfig, [config, savedConfig]);
  const totals = useMemo(() => ({
    pfIrpf: config.pfIrpf.reduce((s, c) => s + c.maxPoints, 0) + config.customCriteria.filter(c => c.applicableTo.includes("pfIrpf")).reduce((s, c) => s + c.maxPoints, 0),
    pj: config.pj.reduce((s, c) => s + c.maxPoints, 0) + config.customCriteria.filter(c => c.applicableTo.includes("pj")).reduce((s, c) => s + c.maxPoints, 0),
  }), [config]);
  const invalidTotals = Object.values(totals).some((total) => total !== 1000);

  const handleSave = async () => {
    if (invalidTotals) {
      toast.error("A soma dos pesos de todas as abas deve ser exatamente 1000 antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      await saveScoringConfig(config);
      setSavedConfig(JSON.stringify(config));
      toast.success("Configurações salvas.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const def = structuredClone(DEFAULT_CONFIG);
    setSaving(true);
    try {
      await saveScoringConfig(def);
      setConfig(def);
      setSavedConfig(JSON.stringify(def));
      toast.success("Configurações restauradas para os valores padrão.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao restaurar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => exportConfig({ ...config, descricao: config.descricao || "Preset de pontuação POSSIBLE" });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importConfig(file);
      setConfig(imported);
      toast.success("Configurações importadas. Clique em Salvar para aplicar.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    }
    e.target.value = "";
  };

  const bandsError = useMemo(() => validateDecisionBands(config.decisionBands), [config.decisionBands]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      {/* Lock bar */}
      <div className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-2">
            <BackButton to="/" />
            <h1 className="text-lg font-semibold text-foreground">Configurações do Motor de Pontuação</h1>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="destructive" className="text-xs">Alterações não salvas</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-6 py-6 space-y-8">
        {/* SECTION 1 & 2: Criteria by tab */}
        <Tabs defaultValue="pfIrpf">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pfIrpf">Pessoa Física (IRPF)</TabsTrigger>
            <TabsTrigger value="pj">Pessoa Jurídica</TabsTrigger>
          </TabsList>

          {(["pfIrpf", "pj"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <CriteriaEditor
                criteria={config[tab]}
                onChange={(c) => setConfig(prev => ({ ...prev, [tab]: c }))}
                customCriteria={config.customCriteria}
                onChangeCustom={(c) => setConfig(prev => ({ ...prev, customCriteria: c }))}
                tabKey={tab}
              />
            </TabsContent>
          ))}
        </Tabs>

        {/* SECTION 3: Decision Bands */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Descrição do preset</h2>
          <Input
            value={config.descricao || ""}
            onChange={(e) => setConfig(prev => ({ ...prev, descricao: e.target.value }))}
            placeholder="Ex: Política conservadora POSSIBLE — abril/2026"
          />
        </section>

        {/* SECTION 3: Decision Bands */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Faixas de Decisão</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2">Decisão</th>
                  <th className="text-center px-4 py-2">Score mínimo</th>
                  <th className="text-center px-4 py-2">Score máximo</th>
                  <th className="text-center px-4 py-2">Cor</th>
                </tr>
              </thead>
              <tbody>
                {config.decisionBands.map((band, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{band.label}</td>
                    <td className="px-4 py-2 text-center">
                      <Input type="number" min={0} max={1000} className="w-20 text-center text-xs mx-auto"
                        value={band.min} onChange={(e) => {
                          const next = [...config.decisionBands];
                          next[i] = { ...next[i], min: parseInt(e.target.value) || 0 };
                          setConfig(prev => ({ ...prev, decisionBands: next }));
                        }} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Input type="number" min={0} max={1000} className="w-20 text-center text-xs mx-auto"
                        value={band.max} onChange={(e) => {
                          const next = [...config.decisionBands];
                          next[i] = { ...next[i], max: parseInt(e.target.value) || 0 };
                          setConfig(prev => ({ ...prev, decisionBands: next }));
                        }} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="mx-auto h-5 w-5 rounded-full" style={{ backgroundColor: band.color }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bandsError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" /> {bandsError}
            </p>
          )}
        </section>

        {/* SECTION 4: Financial Params */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Parâmetros Financeiros</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4">
            <div>
              <label className="text-xs text-muted-foreground">Taxa de juros mensal (%)</label>
              <Input type="number" step={0.1} min={0} value={config.financialParams.taxaMensal}
                onChange={(e) => setConfig(prev => ({
                  ...prev, financialParams: { ...prev.financialParams, taxaMensal: parseFloat(e.target.value) || 0 }
                }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prazo padrão (meses)</label>
              <Input type="number" min={1} value={config.financialParams.prazoPadrao}
                onChange={(e) => setConfig(prev => ({
                  ...prev, financialParams: { ...prev.financialParams, prazoPadrao: parseInt(e.target.value) || 1 }
                }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Penalização campos ausentes (pts)</label>
              <Input type="number" max={0} value={config.financialParams.penalizacaoCamposAusentes}
                onChange={(e) => setConfig(prev => ({
                  ...prev, financialParams: { ...prev.financialParams, penalizacaoCamposAusentes: parseInt(e.target.value) || 0 }
                }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mínimo de campos extraídos (%)</label>
              <Input type="number" min={0} max={100} value={config.financialParams.percentualMinimoExtracoes}
                onChange={(e) => setConfig(prev => ({
                  ...prev, financialParams: { ...prev.financialParams, percentualMinimoExtracoes: parseInt(e.target.value) || 0 }
                }))} />
            </div>
          </div>
        </section>

        {/* SECTION 5: Custom Criteria */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Critérios Customizados</h2>
            <Button variant="outline" size="sm" onClick={() => setAddCustomOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar critério
            </Button>
          </div>
          {config.customCriteria.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center">
              Nenhum critério customizado. Clique em "+ Adicionar critério" para criar.
            </p>
          ) : (
            <div className="space-y-2">
              {config.customCriteria.map(cc => (
                <div key={cc.id} className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-card px-4 py-3">
                  <Badge variant="outline" className="text-xs">Custom</Badge>
                  <span className="flex-1 text-sm">{cc.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {cc.calcType === "boolean" ? "Sim/Não" : "Faixas"} · {cc.maxPoints} pts ·
                    {cc.applicableTo.map(a => a === "pfIrpf" ? " PF IRPF" : " PJ").join(",")}
                  </span>
                  <Button variant="ghost" size="sm" title="Editar"
                    onClick={() => { setEditingCustom(cc); setAddCustomOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Excluir" className="text-destructive"
                    onClick={() => setConfig(prev => ({ ...prev, customCriteria: prev.customCriteria.filter(c => c.id !== cc.id) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground italic">
            Observação: Critérios customizados dependem de dados que a IA consiga extrair dos documentos.
          </p>
        </section>

      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-3 max-w-5xl">
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="mr-1 h-4 w-4" /> Restaurar Padrão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar configurações padrão?</AlertDialogTitle>
                  <AlertDialogDescription>Tem certeza? Isso vai sobrescrever todas as suas configurações.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Importar
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
          <Button onClick={handleSave} className="gap-2" disabled={invalidTotals || saving} title={invalidTotals ? "A soma dos pesos deve ser 1000 em todas as abas" : undefined}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar Configurações"}
            {hasChanges && !saving && <span className="ml-1 h-2 w-2 rounded-full bg-destructive-foreground animate-pulse" />}
          </Button>
        </div>
      </div>

      <AddCustomDialog open={addCustomOpen} onOpenChange={(open) => { setAddCustomOpen(open); if (!open) setEditingCustom(null); }} editCriterion={editingCustom}
        onAdd={(c) => setConfig(prev => ({
          ...prev,
          customCriteria: prev.customCriteria.some(existing => existing.id === c.id)
            ? prev.customCriteria.map(existing => existing.id === c.id ? c : existing)
            : [...prev.customCriteria, c],
        }))} />
    </div>
  );
}
