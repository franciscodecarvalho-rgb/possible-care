import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertTriangle,
  HelpCircle,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  type ScoringConfig,
  type CriterionConfig,
  type RegraLimite,
  DEFAULT_CONFIG,
  validateRanges,
  validateDecisionBands,
} from "@/lib/scoringConfig";
import {
  getScoringConfig,
  saveScoringConfig,
  migrateLocalConfigIfNeeded,
} from "@/lib/scoringConfigService";
import {
  obterPoliticaAtiva,
  listarVersoes,
  salvarNovaVersao,
  obterSugestoesPendentes,
  criarSugestoes,
  marcarSugestoesResolvidas,
  type PoliticaCredito,
  type SugestaoItem,
  type SugestoesConfig,
} from "@/lib/politicaService";
import { supabase } from "@/integrations/supabase/client";

const CRITERION_HELP: Record<string, string> = {
  "Comprometimento de Renda": "Quanto a parcela estimada consome da renda mensal.",
  "Evolução Patrimonial": "Variação do patrimônio em relação à renda anual.",
  "Patrimônio vs Renda": "Razão entre bens declarados e renda anual.",
  Endividamento: "Dívidas em relação ao patrimônio ou ativo total.",
  "Estabilidade de Renda": "Quantidade e qualidade das fontes de renda.",
  "Posse de Bens Reais": "Imóvel e veículo declarados.",
  "Coerência Tributária": "Consistência entre alíquota, imposto e renda declarada.",
  "Liquidez Corrente": "Ativo circulante dividido pelo passivo circulante.",
  "Evolução Faturamento": "Crescimento do faturamento entre períodos.",
  "Margem de Lucro": "Lucro líquido sobre receita.",
  "Comprometimento Crédito/PL": "Crédito solicitado em relação ao patrimônio líquido.",
  "Regularidade Faturamento": "Estabilidade mensal do faturamento.",
  "Tempo de Mercado": "Anos de operação da empresa.",
  "PL Positivo/Crescente": "Patrimônio líquido positivo e em evolução.",
  "Diversificação de Receitas": "Distribuição da receita entre clientes/fontes.",
};

const setByPath = (target: any, path: string, value: unknown): boolean => {
  try {
    const parts = path
      .replace(/\]/g, "")
      .split(/\.|\[/)
      .filter((p) => p.length > 0);
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
      if (cur[key] === undefined || cur[key] === null) return false;
      cur = cur[key];
    }
    const last = parts[parts.length - 1];
    const lastKey = /^\d+$/.test(last) ? Number(last) : last;
    cur[lastKey] = value;
    return true;
  } catch {
    return false;
  }
};

const ConfiguracoesContent = () => {
  const [config, setConfig] = useState<ScoringConfig>(() => structuredClone(DEFAULT_CONFIG));
  const [savedConfig, setSavedConfig] = useState<string>(() => JSON.stringify(DEFAULT_CONFIG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const [politicaAtiva, setPoliticaAtiva] = useState<PoliticaCredito | null>(null);
  const [politicaTexto, setPoliticaTexto] = useState("");
  const [versoes, setVersoes] = useState<PoliticaCredito[]>([]);
  const [salvandoPolitica, setSalvandoPolitica] = useState(false);
  const [gerandoSugestoes, setGerandoSugestoes] = useState(false);

  const [sugestoesPendentes, setSugestoesPendentes] = useState<SugestoesConfig[]>([]);
  const [aplicandoIds, setAplicandoIds] = useState<Set<string>>(new Set());

  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        userIdRef.current = userData.user?.id ?? null;
        await migrateLocalConfigIfNeeded();
        const [loaded, pAtiva, vs, sps] = await Promise.all([
          getScoringConfig(),
          obterPoliticaAtiva(),
          listarVersoes(),
          obterSugestoesPendentes(),
        ]);
        if (!alive) return;
        setConfig(loaded);
        setSavedConfig(JSON.stringify(loaded));
        setPoliticaAtiva(pAtiva);
        setPoliticaTexto(pAtiva?.conteudo ?? "");
        setVersoes(vs);
        setSugestoesPendentes(sps);
      } catch (err: any) {
        toast.error(err?.message || "Erro ao carregar configurações.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hasChanges = useMemo(() => JSON.stringify(config) !== savedConfig, [config, savedConfig]);

  const totals = useMemo(
    () => ({
      pfIrpf: config.pfIrpf.reduce((s, c) => s + c.maxPoints, 0),
      pj: config.pj.reduce((s, c) => s + c.maxPoints, 0),
    }),
    [config],
  );
  const invalidTotals = totals.pfIrpf !== 1000 || totals.pj !== 1000;

  const bandsError = useMemo(() => validateDecisionBands(config.decisionBands), [config.decisionBands]);

  const handleSaveConfig = async () => {
    if (invalidTotals) {
      toast.error("Soma de pesos deve ser 1000 em PF (IRPF) e em PJ.");
      return;
    }
    if (bandsError) {
      toast.error(bandsError);
      return;
    }
    setSaving(true);
    try {
      await saveScoringConfig(config);
      setSavedConfig(JSON.stringify(config));
      toast.success("Configurações salvas.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar configurações.");
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
      toast.success("Configurações restauradas para os padrões.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao restaurar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const recarregarPolitica = async () => {
    const [pAtiva, vs] = await Promise.all([obterPoliticaAtiva(), listarVersoes()]);
    setPoliticaAtiva(pAtiva);
    setVersoes(vs);
    setPoliticaTexto(pAtiva?.conteudo ?? "");
  };

  const recarregarSugestoes = async () => {
    const sps = await obterSugestoesPendentes();
    setSugestoesPendentes(sps);
  };

  const handleSalvarPolitica = async () => {
    if (!politicaTexto.trim()) {
      toast.error("O conteúdo da política não pode ficar vazio.");
      return;
    }
    setSalvandoPolitica(true);
    try {
      const nova = await salvarNovaVersao(politicaTexto.trim());
      toast.success(`Versão ${nova.versao} salva. Gerando sugestões…`);
      await recarregarPolitica();
      // Dispara sugestões em paralelo
      setGerandoSugestoes(true);
      const { data, error } = await supabase.functions.invoke("sugerir-ajustes-config", {
        body: { politica: nova.conteudo, config },
      });
      if (error) throw new Error(error.message || "Erro ao chamar sugerir-ajustes-config.");
      if (data?.error) throw new Error(data.error);
      const arr = Array.isArray(data?.sugestoes) ? (data.sugestoes as SugestaoItem[]) : [];
      if (arr.length === 0) {
        toast.info("Nenhuma sugestão automática gerada pela IA.");
      } else {
        await criarSugestoes(nova.id, arr);
        await recarregarSugestoes();
        toast.success(`${arr.length} sugestão(ões) geradas — revise na aba Parâmetros.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar política.");
    } finally {
      setSalvandoPolitica(false);
      setGerandoSugestoes(false);
    }
  };

  const aplicarSugestaoIndividual = async (
    sug: SugestoesConfig,
    indices: number[],
    descarteRestante: boolean,
  ) => {
    if (indices.length === 0) {
      toast.error("Selecione ao menos uma sugestão.");
      return;
    }
    setAplicandoIds((prev) => new Set(prev).add(sug.id));
    try {
      const next = structuredClone(config);
      let aplicadas = 0;
      for (const i of indices) {
        const item = sug.sugestoes[i];
        if (!item) continue;
        if (setByPath(next, item.campo, item.valor_sugerido)) aplicadas++;
      }
      if (aplicadas === 0) {
        toast.error("Nenhuma sugestão pôde ser aplicada (path inválido).");
        return;
      }
      await saveScoringConfig(next);
      setConfig(next);
      setSavedConfig(JSON.stringify(next));

      const total = sug.sugestoes.length;
      const status =
        aplicadas === total && !descarteRestante
          ? "aplicada_total"
          : indices.length === total
            ? "aplicada_total"
            : "aplicada_parcial";
      await marcarSugestoesResolvidas(sug.id, status);
      await recarregarSugestoes();
      toast.success(`${aplicadas} sugestão(ões) aplicadas.`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aplicar sugestões.");
    } finally {
      setAplicandoIds((prev) => {
        const c = new Set(prev);
        c.delete(sug.id);
        return c;
      });
    }
  };

  const descartarTodasDeUmGrupo = async (sug: SugestoesConfig) => {
    setAplicandoIds((prev) => new Set(prev).add(sug.id));
    try {
      await marcarSugestoesResolvidas(sug.id, "descartada");
      await recarregarSugestoes();
      toast.success("Sugestões descartadas.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao descartar.");
    } finally {
      setAplicandoIds((prev) => {
        const c = new Set(prev);
        c.delete(sug.id);
        return c;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <div className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-2">
            <BackButton to="/" />
            <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="destructive" className="text-xs">
                Alterações não salvas
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-6 py-6">
        <Tabs defaultValue="politica">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="politica">Política de Crédito</TabsTrigger>
            <TabsTrigger value="parametros">Parâmetros do Score</TabsTrigger>
          </TabsList>

          <TabsContent value="politica" className="mt-6 space-y-4">
            <div className="rounded-lg border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Política vigente</h2>
                  {politicaAtiva ? (
                    <p className="text-xs text-muted-foreground">
                      Versão {politicaAtiva.versao} · criada em{" "}
                      {new Date(politicaAtiva.criada_em).toLocaleString("pt-BR")}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma política vigente.</p>
                  )}
                </div>
              </div>
              <Textarea
                rows={14}
                value={politicaTexto}
                onChange={(e) => setPoliticaTexto(e.target.value)}
                placeholder="Descreva em texto natural a política de concessão de crédito (cortes, faixas, regras de limite, validade…)."
              />
              <div className="flex flex-wrap items-center justify-end gap-3">
                {gerandoSugestoes && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 animate-pulse" /> Analisando política com IA…
                  </span>
                )}
                <Button
                  onClick={handleSalvarPolitica}
                  disabled={salvandoPolitica || gerandoSugestoes}
                  className="bg-navy text-navy-foreground hover:bg-navy-light"
                >
                  {salvandoPolitica ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Salvar nova versão e gerar sugestões
                </Button>
              </div>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="historico">
                <AccordionTrigger>Histórico de versões ({versoes.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {versoes.map((v) => (
                      <div key={v.id} className="rounded-md border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            Versão {v.versao} {v.ativa && <Badge className="ml-1">ativa</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(v.criada_em).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs text-foreground">
                          {v.conteudo}
                        </pre>
                      </div>
                    ))}
                    {versoes.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sem versões registradas.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="parametros" className="mt-6 space-y-6">
            {sugestoesPendentes.length > 0 && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" /> Sugestões pendentes
                </h3>
                {sugestoesPendentes.map((sug) => (
                  <SugestoesBlock
                    key={sug.id}
                    sug={sug}
                    aplicando={aplicandoIds.has(sug.id)}
                    onAplicar={(indices) =>
                      aplicarSugestaoIndividual(sug, indices, indices.length < sug.sugestoes.length)
                    }
                    onDescartar={() => descartarTodasDeUmGrupo(sug)}
                  />
                ))}
              </div>
            )}

            <section className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Descrição do preset</label>
              <Input
                value={config.descricao || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Política conservadora POSSIBLE — maio/2026"
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Pesos por critério — total deve ser 1000 em cada aba
              </h2>
              <Tabs defaultValue="pfIrpf">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pfIrpf">Pessoa Física (IRPF)</TabsTrigger>
                  <TabsTrigger value="pj">Pessoa Jurídica</TabsTrigger>
                </TabsList>

                {(["pfIrpf", "pj"] as const).map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-4">
                    <CriteriaEditor
                      criteria={config[tab]}
                      onChange={(c) => setConfig((prev) => ({ ...prev, [tab]: c }))}
                      total={totals[tab]}
                      advanced={advanced}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Faixas de Decisão</h2>
              <div className="rounded-lg border bg-card overflow-hidden">
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
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2 font-medium">{band.label}</td>
                        <td className="px-4 py-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={1000}
                            className="mx-auto w-24 text-center text-xs"
                            value={band.min}
                            onChange={(e) => {
                              const next = [...config.decisionBands];
                              next[i] = { ...next[i], min: parseInt(e.target.value) || 0 };
                              setConfig((prev) => ({ ...prev, decisionBands: next }));
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={1000}
                            className="mx-auto w-24 text-center text-xs"
                            value={band.max}
                            onChange={(e) => {
                              const next = [...config.decisionBands];
                              next[i] = { ...next[i], max: parseInt(e.target.value) || 0 };
                              setConfig((prev) => ({ ...prev, decisionBands: next }));
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div
                            className="mx-auto h-5 w-5 rounded-full"
                            style={{ backgroundColor: band.color }}
                          />
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

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Cortes para Fiador</h2>
              <div className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Corte PF (score mínimo sem fiador)</label>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={config.corteFiadorPf}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        corteFiadorPf: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Corte PJ (score mínimo sem fiador)</label>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={config.corteFiadorPj}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        corteFiadorPj: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Regras de Limite</h2>
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-center px-4 py-2">Score mín.</th>
                      <th className="text-center px-4 py-2">Score máx.</th>
                      <th className="text-center px-4 py-2">% do valor</th>
                      <th className="text-center px-4 py-2">Parcelas máx.</th>
                      <th className="text-right px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.regrasLimite.map((r, i) => (
                      <tr key={i} className="border-t">
                        {(["scoreMin", "scoreMax", "percentual", "parcelasMax"] as const).map(
                          (field) => (
                            <td key={field} className="px-4 py-2 text-center">
                              <Input
                                type="number"
                                min={0}
                                max={field === "scoreMin" || field === "scoreMax" ? 1000 : undefined}
                                value={r[field]}
                                onChange={(e) => {
                                  const next = [...config.regrasLimite];
                                  next[i] = { ...next[i], [field]: parseInt(e.target.value) || 0 };
                                  setConfig((prev) => ({ ...prev, regrasLimite: next }));
                                }}
                                className="mx-auto w-20 text-center text-xs"
                              />
                            </td>
                          ),
                        )}
                        <td className="px-2 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const next = config.regrasLimite.filter((_, j) => j !== i);
                              setConfig((prev) => ({ ...prev, regrasLimite: next }));
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const novaRegra: RegraLimite = {
                    scoreMin: 0,
                    scoreMax: 0,
                    percentual: 0,
                    parcelasMax: 0,
                  };
                  setConfig((prev) => ({
                    ...prev,
                    regrasLimite: [...prev.regrasLimite, novaRegra],
                  }));
                }}
              >
                + Adicionar faixa
              </Button>
            </section>

            <section className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div>
                <p className="text-sm font-semibold">Modo avançado</p>
                <p className="text-xs text-muted-foreground">
                  Expõe faixas internas dos critérios, parâmetros financeiros e validade da análise.
                </p>
              </div>
              <Switch checked={advanced} onCheckedChange={setAdvanced} />
            </section>

            {advanced && (
              <>
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-foreground">Parâmetros financeiros</h2>
                  <div className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Taxa de juros mensal (%)</label>
                      <Input
                        type="number"
                        step={0.1}
                        min={0}
                        value={config.financialParams.taxaMensal}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            financialParams: {
                              ...prev.financialParams,
                              taxaMensal: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Prazo padrão (meses)</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.financialParams.prazoPadrao}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            financialParams: {
                              ...prev.financialParams,
                              prazoPadrao: parseInt(e.target.value) || 1,
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Mínimo de campos extraídos (%)</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={config.financialParams.percentualMinimoExtracoes}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            financialParams: {
                              ...prev.financialParams,
                              percentualMinimoExtracoes: parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Validade da análise (dias)</label>
                      <Input
                        type="number"
                        min={1}
                        value={config.validadeAnaliseDias}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            validadeAnaliseDias: parseInt(e.target.value) || 1,
                          }))
                        }
                      />
                    </div>
                  </div>
                </section>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-3 max-w-5xl">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1 h-4 w-4" /> Restaurar Padrão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restaurar configurações padrão?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza? Isso vai sobrescrever todas as suas configurações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={handleSaveConfig} disabled={invalidTotals || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Salvando…" : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const CriteriaEditor = ({
  criteria,
  onChange,
  total,
  advanced,
}: {
  criteria: CriterionConfig[];
  onChange: (c: CriterionConfig[]) => void;
  total: number;
  advanced: boolean;
}) => {
  return (
    <div className="space-y-3">
      {criteria.map((c, ci) => {
        const rangeError = validateRanges(c.ranges);
        return (
          <div key={c.id} className="rounded-lg border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex flex-1 items-center gap-2 text-sm font-medium">
                {c.name}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {CRITERION_HELP[c.name] || "Critério calculado a partir dos dados extraídos."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <Input
                type="number"
                min={0}
                max={1000}
                className="w-24 text-center"
                value={c.maxPoints}
                onChange={(e) => {
                  const next = [...criteria];
                  next[ci] = { ...next[ci], maxPoints: parseInt(e.target.value) || 0 };
                  onChange(next);
                }}
              />
            </div>
            {advanced && (
              <div className="border-t bg-muted/30 px-4 py-3">
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
                      <tr key={ri} className="border-t">
                        <td className="py-2">{r.label}</td>
                        <td className="py-2 text-center">
                          <Input
                            type="number"
                            className="mx-auto w-16 text-center text-xs"
                            value={r.min}
                            onChange={(e) => {
                              const next = [...criteria];
                              const ranges = [...next[ci].ranges];
                              ranges[ri] = { ...ranges[ri], min: parseFloat(e.target.value) || 0 };
                              next[ci] = { ...next[ci], ranges };
                              onChange(next);
                            }}
                          />
                        </td>
                        <td className="py-2 text-center">
                          <Input
                            type="number"
                            className="mx-auto w-16 text-center text-xs"
                            value={r.max}
                            onChange={(e) => {
                              const next = [...criteria];
                              const ranges = [...next[ci].ranges];
                              ranges[ri] = { ...ranges[ri], max: parseFloat(e.target.value) || 0 };
                              next[ci] = { ...next[ci], ranges };
                              onChange(next);
                            }}
                          />
                        </td>
                        <td className="py-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="mx-auto w-16 text-center text-xs"
                            value={r.percentage}
                            onChange={(e) => {
                              const next = [...criteria];
                              const ranges = [...next[ci].ranges];
                              ranges[ri] = {
                                ...ranges[ri],
                                percentage: parseInt(e.target.value) || 0,
                              };
                              next[ci] = { ...next[ci], ranges };
                              onChange(next);
                            }}
                          />
                        </td>
                        <td className="py-2 text-center font-medium">
                          {Math.round((c.maxPoints * r.percentage) / 100)}
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

      <div
        className={`flex items-center justify-between rounded-lg px-4 py-3 font-semibold ${
          total === 1000 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        }`}
      >
        <span>TOTAL</span>
        <span>{total === 1000 ? `${total} ✅` : `${total} — deve ser 1000`}</span>
      </div>
    </div>
  );
};

const SugestoesBlock = ({
  sug,
  aplicando,
  onAplicar,
  onDescartar,
}: {
  sug: SugestoesConfig;
  aplicando: boolean;
  onAplicar: (indices: number[]) => void;
  onDescartar: () => void;
}) => {
  const [selecionados, setSelecionados] = useState<Set<number>>(
    () => new Set(sug.sugestoes.map((_, i) => i)),
  );

  const toggle = (i: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {sug.sugestoes.length} sugestão(ões) ·{" "}
          {new Date(sug.criada_em).toLocaleString("pt-BR")}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAplicar([...selecionados].sort((a, b) => a - b))}
            disabled={aplicando || selecionados.size === 0}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Aplicar selecionadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDescartar}
            disabled={aplicando}
          >
            <XCircle className="mr-1 h-3 w-3" /> Descartar todas
          </Button>
        </div>
      </div>
      <ul className="space-y-2">
        {sug.sugestoes.map((s, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-md border p-2 ${
              selecionados.has(i) ? "border-primary/40 bg-primary/5" : "border-border"
            }`}
          >
            <input
              type="checkbox"
              checked={selecionados.has(i)}
              onChange={() => toggle(i)}
              className="mt-1"
            />
            <div className="flex-1 text-xs">
              <p className="font-mono text-foreground">{s.campo}</p>
              <p className="text-muted-foreground">
                {String(s.valor_atual)} → <span className="font-semibold text-foreground">{String(s.valor_sugerido)}</span>
              </p>
              <p className="mt-1 italic text-muted-foreground">{s.motivo}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Configuracoes = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingPerm, setLoadingPerm] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) {
          if (alive) setIsAdmin(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", uid)
          .maybeSingle();
        if (error) {
          console.error("Erro ao checar admin:", error);
          if (alive) setIsAdmin(false);
          return;
        }
        if (alive) setIsAdmin(Boolean(data?.is_admin));
      } finally {
        if (alive) setLoadingPerm(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loadingPerm) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Verificando permissão…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-xl px-6 py-24 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-yellow-600" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            Apenas administradores podem acessar configurações
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Procure um administrador da conta caso precise ajustar a política, faixas ou
            parâmetros do motor de pontuação.
          </p>
          <BackButton to="/" />
        </main>
      </div>
    );
  }

  return <ConfiguracoesContent />;
};

export default Configuracoes;
