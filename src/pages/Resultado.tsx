import { useLocation, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileText,
  Download,
  SlidersHorizontal,
  AlertTriangle,
  UserPlus,
  ShieldAlert,
  Loader2,
  Wallet,
  Save,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import FileDropzone from "@/components/FileDropzone";
import { useEffect, useRef, useState } from "react";
import { scorePF, scorePJ, type ScoringResult } from "@/lib/creditScoring";
import { generateAnalysis } from "@/lib/reportAnalysis";
import { saveHistoryResult, updateHistoryResult } from "@/lib/historyService";
import { listarFiadores, type Fiador } from "@/lib/fiadorService";
import {
  obterBureauDaAnalise,
  salvarBureau,
  type Bureau,
  type BureauTipo,
} from "@/lib/bureauService";
import { extractBureauFromFile } from "@/lib/extractionService";
import { loadConfig } from "@/lib/scoringConfig";
import { maskDocumento } from "@/lib/clienteService";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtMoney = (v: number | null | undefined) =>
  typeof v === "number" ? fmt(v) : "—";

const fmtNumber = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("pt-BR") : "—";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

const barColor = (pct: number) =>
  pct >= 70 ? "#16a34a" : pct >= 40 ? "#eab308" : "#dc2626";

const Resultado = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustJustification, setAdjustJustification] = useState("");
  const [fiadores, setFiadores] = useState<Fiador[]>([]);
  const [carregandoFiadores, setCarregandoFiadores] = useState(false);
  const [bureau, setBureau] = useState<Bureau | null>(null);
  const [carregandoBureau, setCarregandoBureau] = useState(false);
  const [bureauModalOpen, setBureauModalOpen] = useState(false);
  const [bureauTipo, setBureauTipo] = useState<BureauTipo>("serasa");
  const [bureauFile, setBureauFile] = useState<File[]>([]);
  const [bureauUploading, setBureauUploading] = useState(false);
  const [bureauProgress, setBureauProgress] = useState("");
  const [limiteAprovadoInput, setLimiteAprovadoInput] = useState<string>("");
  const [parcelasAprovadasInput, setParcelasAprovadasInput] = useState<string>("");
  const [justificativaInput, setJustificativaInput] = useState<string>("");
  const [salvandoLiberacao, setSalvandoLiberacao] = useState(false);

  const extractedData = location.state?.extractedData as Record<string, any> | undefined;
  const tipo = (location.state?.tipo as string) || "pf";
  const formData = location.state?.formData as { valor: number; prazo: number; finalidade: string } | undefined;
  const clienteIdState = (location.state?.clienteId as string | undefined) ?? null;

  useEffect(() => {
    if (location.state?.fromHistory) {
      setResult(location.state.fromHistory as ScoringResult);
      return;
    }
    if (!extractedData || !formData) return;
    let r: ScoringResult | null = null;
    if (tipo === "pf") {
      r = scorePF(extractedData, formData.valor, formData.prazo, formData.finalidade);
    } else if (tipo === "pj") {
      r = scorePJ(extractedData, formData.valor, formData.prazo, formData.finalidade);
    }
    if (r) {
      const computed = r;
      saveHistoryResult(computed, clienteIdState)
        .then(({ id }) => setResult({ ...computed, id, clienteId: clienteIdState }))
        .catch((e) => {
          console.error(e);
          toast.error("Falha ao salvar análise no histórico.");
          setResult(computed);
        });
    }
  }, []);

  useEffect(() => {
    if (!result?.id) {
      setFiadores([]);
      setBureau(null);
      return;
    }
    let alive = true;
    setCarregandoFiadores(true);
    setCarregandoBureau(true);
    listarFiadores(result.id)
      .then((data) => alive && setFiadores(data))
      .catch((e) => alive && toast.error(e?.message || "Erro ao carregar fiadores."))
      .finally(() => alive && setCarregandoFiadores(false));
    obterBureauDaAnalise(result.id)
      .then((data) => alive && setBureau(data))
      .catch((e) => alive && toast.error(e?.message || "Erro ao carregar bureau."))
      .finally(() => alive && setCarregandoBureau(false));
    return () => {
      alive = false;
    };
  }, [result?.id]);

  // Auto-export when coming from history with autoExport flag
  useEffect(() => {
    if (result && location.state?.autoExport && reportRef.current) {
      const timer = setTimeout(() => handleExportPDF(), 600);
      return () => clearTimeout(timer);
    }
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const limiteEdit =
      result.limiteAprovado ??
      result.limiteSugerido ??
      null;
    const parcelasEdit =
      result.parcelasAprovadas ??
      result.parcelasSugeridas ??
      null;
    setLimiteAprovadoInput(limiteEdit !== null ? String(limiteEdit) : "");
    setParcelasAprovadasInput(parcelasEdit !== null ? String(parcelasEdit) : "");
    setJustificativaInput(result.justificativaAjuste ?? "");
  }, [result?.id, result?.limiteSugerido, result?.parcelasSugeridas]);

  const handleExportPDF = async () => {
    if (!reportRef.current || !result) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth() - 30;
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 15, 15, pdfW, pdfH);

      const nome = (result.extractedData?.nome_completo || "Cliente").replace(/\s+/g, "_");
      const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "");
      pdf.save(`Analise_Credito_${nome}_${dateStr}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handleManualAdjust = async () => {
    if (!result || !adjustJustification.trim()) {
      toast.error("Informe a justificativa do ajuste manual.");
      return;
    }
    const originalScore = result.originalScore ?? result.score;
    const score = Math.max(0, Math.min(1000, originalScore + adjustPoints));
    const next = {
      ...result,
      originalScore,
      score,
      manualAdjustment: {
        points: adjustPoints,
        justification: adjustJustification.trim(),
        adjustedAt: new Date().toISOString(),
      },
    };
    try {
      await updateHistoryResult(next);
      setResult(next);
      setAdjustOpen(false);
      toast.success("Ajuste manual registrado no relatório.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar ajuste manual.");
    }
  };

  const handleSalvarLiberacao = async () => {
    if (!result) return;
    const limiteAprovado = limiteAprovadoInput.trim() === "" ? null : Number(limiteAprovadoInput);
    const parcelasAprovadas =
      parcelasAprovadasInput.trim() === "" ? null : Number(parcelasAprovadasInput);
    if (
      (limiteAprovadoInput !== "" && (isNaN(limiteAprovado!) || limiteAprovado! < 0)) ||
      (parcelasAprovadasInput !== "" && (isNaN(parcelasAprovadas!) || parcelasAprovadas! < 0))
    ) {
      toast.error("Informe valores numéricos válidos para limite e parcelas.");
      return;
    }
    const diffLimite = limiteAprovado !== (result.limiteSugerido ?? null);
    const diffParcelas = parcelasAprovadas !== (result.parcelasSugeridas ?? null);
    const ajustado = diffLimite || diffParcelas;
    if (ajustado && !justificativaInput.trim()) {
      toast.error("Justificativa é obrigatória quando a liberação difere da sugestão.");
      return;
    }
    setSalvandoLiberacao(true);
    try {
      const next: ScoringResult = {
        ...result,
        limiteAprovado,
        parcelasAprovadas,
        limiteAjustadoManualmente: ajustado,
        justificativaAjuste: ajustado ? justificativaInput.trim() : null,
      };
      await updateHistoryResult(next);
      setResult(next);
      toast.success("Liberação salva.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar liberação.");
    } finally {
      setSalvandoLiberacao(false);
    }
  };

  const handleUploadBureau = async () => {
    if (!result?.id) {
      toast.error("Análise sem id persistido — refaça a análise.");
      return;
    }
    if (bureauFile.length === 0) {
      toast.error("Selecione o PDF do bureau.");
      return;
    }
    setBureauUploading(true);
    try {
      const file = bureauFile[0];
      const extracted = await extractBureauFromFile(file, setBureauProgress);
      const saved = await salvarBureau(result.id, bureauTipo, extracted, file.name);
      setBureau(saved);
      setBureauModalOpen(false);
      setBureauFile([]);
      toast.success("Bureau anexado com sucesso.");
    } catch (err: any) {
      console.error("Upload bureau erro:", err);
      toast.error(err?.message || "Erro ao processar relatório do bureau.");
    } finally {
      setBureauUploading(false);
      setBureauProgress("");
    }
  };

  if (!extractedData && !location.state?.fromHistory) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Nenhum dado para exibir.</p>
          <BackButton to="/" />
        </main>
      </div>
    );
  }

  if (!result) return null;

  const analysis = generateAnalysis(result);
  const ed = result.extractedData || {};
  const fd = result.formData;

  const config = loadConfig();
  const corteFiador = result.tipo === "pj" ? config.corteFiadorPj : config.corteFiadorPf;
  const abaixoDoCorte = !result.insufficientData && result.score < corteFiador;
  const exigeFiador = abaixoDoCorte && fiadores.length === 0;
  const podeAdicionarFiador = Boolean(result.id);

  return (
    <div className="min-h-screen bg-muted">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Action bar */}
        <div className="mb-6 flex items-center justify-between">
          <BackButton to={location.state?.fromHistory ? "/historico" : "/preview"} />
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/historico")}>
              Ver Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Ajustar Score Manualmente
            </Button>
            <Button
              size="sm"
              className="bg-navy text-navy-foreground hover:bg-navy-light"
              onClick={handleExportPDF}
              disabled={exporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportando..." : "Exportar Relatório em PDF"}
            </Button>
          </div>
        </div>

        {exigeFiador && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-700" />
              <p className="text-sm text-yellow-900">
                Score abaixo do corte ({corteFiador}). Esta análise exige cadastro de fiador.
              </p>
            </div>
            {podeAdicionarFiador && (
              <Button
                size="sm"
                onClick={() => navigate(`/analise/${result.id}/fiador/novo`)}
                className="bg-yellow-600 text-white hover:bg-yellow-700"
              >
                <UserPlus className="mr-2 h-4 w-4" /> Adicionar fiador
              </Button>
            )}
          </div>
        )}

        {/* Layout 3 colunas em desktop: Titular | Fiador | Bureau */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {/* Titular ocupa 2 colunas (mantém A4) */}
          <div className="lg:col-span-2 xl:col-span-2">
            <div
              ref={reportRef}
              className="mx-auto bg-white shadow-xl"
              style={{
                width: "210mm",
                maxWidth: "100%",
                minHeight: "297mm",
                padding: "15mm",
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                color: "#1a1a2e",
                fontSize: "11px",
                lineHeight: "1.5",
              }}
            >
              <div style={{ textAlign: "center", borderBottom: "2px solid #1e3a5f", paddingBottom: "10px", marginBottom: "16px" }}>
                <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "1px", margin: 0, color: "#1e3a5f" }}>
                  RELATÓRIO DE ANÁLISE DE CRÉDITO
                </h1>
                <p style={{ fontSize: "10px", color: "#6b7280", marginTop: "6px" }}>
                  Data: {fmtDate(result.data)} &nbsp;|&nbsp; Protocolo: {result.protocolo} &nbsp;|&nbsp; Tipo: {tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                </p>
              </div>

              <div style={{ textAlign: "center", padding: "16px 0", marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#6b7280", margin: 0 }}>
                  Score de Crédito
                </p>
                <p style={{ fontSize: "48px", fontWeight: 800, color: result.decisionColor, margin: "4px 0 0 0", lineHeight: 1.1 }}>
                  {result.score} <span style={{ fontSize: "18px", fontWeight: 400, color: "#9ca3af" }}>/ 1000</span>
                </p>
                <div style={{ maxWidth: "400px", margin: "12px auto 0", background: "#e5e7eb", borderRadius: "6px", height: "10px", overflow: "hidden" }}>
                  <div style={{ width: `${(result.score / 1000) * 100}%`, height: "100%", borderRadius: "6px", background: result.decisionColor, transition: "width 0.5s" }} />
                </div>
                <div
                  style={{
                    display: "inline-block",
                    marginTop: "12px",
                    padding: "6px 20px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#fff",
                    backgroundColor: result.decisionColor,
                  }}
                >
                  {result.decision}
                </div>
              </div>

              <div style={{ display: "flex", gap: "24px", marginBottom: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>Identificação</p>
                  <table style={{ width: "100%", fontSize: "11px" }}>
                    <tbody>
                      <Row label="Nome" value={ed.nome_completo || ed.razao_social || ed.balancos?.razao_social || "NÃO INFORMADO"} />
                      <Row label="CPF/CNPJ" value={ed.cpf || ed.cnpj || ed.balancos?.cnpj || ed.faturamento?.cnpj || "NÃO INFORMADO"} />
                      {result.tipo === "pf" && <Row label="Ocupação" value={ed.ocupacao || "NÃO INFORMADO"} />}
                    </tbody>
                  </table>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>Solicitação</p>
                  <table style={{ width: "100%", fontSize: "11px" }}>
                    <tbody>
                      <Row label="Valor" value={fmt(fd.valor)} />
                      <Row label="Prazo" value={`${fd.prazo} meses`} />
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginBottom: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: "8px" }}>Resumo Analítico</p>
                {result.tipo === "pj" && result.pjDocType && (
                  <p style={{ fontSize: "10px", color: "#6b7280", fontStyle: "italic", marginBottom: "8px", padding: "6px 10px", background: "#f3f4f6", borderRadius: "4px" }}>
                    Análise baseada em {result.pjDocType === "balancos" ? "Balanços Patrimoniais" : "Relatório de Faturamento"}.
                    Critérios sem dados disponíveis foram desconsiderados e seus pesos redistribuídos.
                  </p>
                )}
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#374151" }}>
                  {analysis.map((line, i) => (
                    <li key={i} style={{ marginBottom: "4px" }}>{line}</li>
                  ))}
                </ul>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: "8px" }}>Detalhamento da Pontuação</p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #d1d5db" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "#374151" }}>Critério</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, color: "#374151", width: "60px" }}>Máx</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, color: "#374151", width: "60px" }}>Obtido</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600, color: "#374151", width: "80px" }}>% Aproveit.</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "#374151", width: "140px" }}>Desempenho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((b, i) => {
                      const pct = (b.points / b.maxPoints) * 100;
                      return (
                        <tr key={b.category} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                          <td style={{ padding: "6px 8px" }}>{b.category}</td>
                          <td style={{ textAlign: "center", padding: "6px 8px", color: "#6b7280" }}>{b.maxPoints}</td>
                          <td style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600 }}>{b.points}</td>
                          <td style={{ textAlign: "center", padding: "6px 8px", fontWeight: 600 }}>{Math.round(pct)}%</td>
                          <td style={{ padding: "6px 8px" }}>
                            <div style={{ background: "#e5e7eb", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", borderRadius: "4px", backgroundColor: barColor(pct) }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid #374151", fontWeight: 700 }}>
                      <td style={{ padding: "6px 8px" }}>TOTAL</td>
                      <td style={{ textAlign: "center", padding: "6px 8px" }}>1000</td>
                      <td style={{ textAlign: "center", padding: "6px 8px", color: result.decisionColor }}>{result.score}</td>
                      <td style={{ textAlign: "center", padding: "6px 8px", color: result.decisionColor }}>{Math.round((result.score / 1000) * 100)}%</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              {result.manualAdjustment && (
                <div style={{ marginTop: "14px", borderTop: "1px solid #e5e7eb", paddingTop: "10px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", color: "#6b7280", marginBottom: "6px" }}>Nota de Auditoria — Ajuste Manual</p>
                  <p style={{ fontSize: "10px", color: "#374151", margin: 0 }}>
                    Score original: {result.originalScore} | Ajuste: {result.manualAdjustment.points > 0 ? "+" : ""}{result.manualAdjustment.points} pontos | Justificativa: {result.manualAdjustment.justification}
                  </p>
                </div>
              )}

              <div style={{ marginTop: "24px", borderTop: "1px solid #d1d5db", paddingTop: "10px", textAlign: "center" }}>
                <p style={{ fontSize: "8px", color: "#9ca3af", margin: 0 }}>
                  Este relatório constitui ferramenta auxiliar de análise. A decisão final sobre a concessão de crédito é de exclusiva responsabilidade do analista.
                </p>
                <p style={{ fontSize: "8px", color: "#9ca3af", marginTop: "2px" }}>
                  Analisador de Crédito - POSSIBLE &nbsp;|&nbsp; {fmtDate(result.data)}
                </p>
              </div>
            </div>
          </div>

          {/* Coluna Fiador */}
          <aside className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserPlus className="h-4 w-4" /> Fiador
                </h2>
                {podeAdicionarFiador && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/analise/${result.id}/fiador/novo`)}
                  >
                    {fiadores.length === 0 ? "Adicionar" : "Outro"}
                  </Button>
                )}
              </div>

              {!podeAdicionarFiador && (
                <p className="text-xs text-muted-foreground">
                  Análise antiga sem vínculo persistido. Para cadastrar fiador, refaça a análise pelo
                  cliente.
                </p>
              )}

              {podeAdicionarFiador && carregandoFiadores && (
                <p className="text-xs text-muted-foreground">Carregando fiadores…</p>
              )}

              {podeAdicionarFiador && !carregandoFiadores && fiadores.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum fiador cadastrado para esta análise.
                </p>
              )}

              <div className="space-y-3">
                {fiadores.map((f) => {
                  const tipoFiador = f.tipo as "pf" | "pj";
                  return (
                    <div key={f.id} className="rounded-md border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{f.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {maskDocumento(f.documento, tipoFiador)} · {tipoFiador.toUpperCase()}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                          style={{ backgroundColor: f.decision_color }}
                        >
                          {f.score}
                        </span>
                      </div>
                      <p
                        className="mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: f.decision_color }}
                      >
                        {f.decision}
                      </p>
                      {Array.isArray(f.breakdown) && f.breakdown.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                          {f.breakdown.slice(0, 4).map((b, i) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="truncate">{b.category}</span>
                              <span className="shrink-0 font-medium text-foreground">
                                {b.points}/{b.maxPoints}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Score do fiador é informativo. A decisão e o ajuste manual aplicam ao titular.
            </p>
          </aside>

          {/* Coluna Bureau */}
          <aside className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldAlert className="h-4 w-4" /> Bureau de crédito
                </h2>
                {podeAdicionarFiador && !bureau && (
                  <Button size="sm" variant="outline" onClick={() => setBureauModalOpen(true)}>
                    Anexar
                  </Button>
                )}
                {podeAdicionarFiador && bureau && (
                  <Button size="sm" variant="ghost" onClick={() => setBureauModalOpen(true)}>
                    Substituir
                  </Button>
                )}
              </div>

              {!podeAdicionarFiador && (
                <p className="text-xs text-muted-foreground">
                  Análise antiga sem id persistido. Não é possível anexar bureau.
                </p>
              )}

              {podeAdicionarFiador && carregandoBureau && (
                <p className="text-xs text-muted-foreground">Carregando bureau…</p>
              )}

              {podeAdicionarFiador && !carregandoBureau && !bureau && (
                <p className="text-xs text-muted-foreground">
                  Nenhum relatório de Serasa ou Boa Vista anexado.
                </p>
              )}

              {bureau && <BureauResumo bureau={bureau} />}
            </div>
            <p className="text-xs text-muted-foreground">
              Bureau é informativo. Não altera o score do titular.
            </p>
          </aside>
        </div>

        {/* Liberação */}
        <section className="mt-6 rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Liberação</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-md border bg-muted/40 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Liberação sugerida
              </p>
              <SugestaoLinha
                label="Limite"
                value={
                  typeof result.limiteSugerido === "number" ? fmt(result.limiteSugerido) : "—"
                }
              />
              <SugestaoLinha
                label="Parcelas"
                value={
                  typeof result.parcelasSugeridas === "number"
                    ? `até ${result.parcelasSugeridas}x`
                    : "—"
                }
              />
              <SugestaoLinha
                label="Validade"
                value={result.validadeAnalise ? formatarDataISO(result.validadeAnalise) : "—"}
              />
              <p className="text-[11px] italic text-muted-foreground">
                Calculado automaticamente a partir do score, valor solicitado e regras de limite.
              </p>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Liberação aprovada (editável)
              </p>
              <div className="space-y-2">
                <Label htmlFor="limiteAprovado">Limite aprovado (R$)</Label>
                <Input
                  id="limiteAprovado"
                  type="number"
                  min="0"
                  step="0.01"
                  value={limiteAprovadoInput}
                  onChange={(e) => setLimiteAprovadoInput(e.target.value)}
                  disabled={!result.id || salvandoLiberacao}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parcelasAprovadas">Parcelas aprovadas</Label>
                <Input
                  id="parcelasAprovadas"
                  type="number"
                  min="0"
                  step="1"
                  value={parcelasAprovadasInput}
                  onChange={(e) => setParcelasAprovadasInput(e.target.value)}
                  disabled={!result.id || salvandoLiberacao}
                />
              </div>
              {liberacaoDiferente(result, limiteAprovadoInput, parcelasAprovadasInput) && (
                <div className="space-y-2">
                  <Label htmlFor="justificativaAjuste" className="text-yellow-700">
                    Justificativa (obrigatória — liberação difere da sugestão)
                  </Label>
                  <Textarea
                    id="justificativaAjuste"
                    value={justificativaInput}
                    onChange={(e) => setJustificativaInput(e.target.value)}
                    placeholder="Descreva o motivo da diferença"
                    disabled={salvandoLiberacao}
                  />
                </div>
              )}
              <Button
                size="sm"
                onClick={handleSalvarLiberacao}
                disabled={!result.id || salvandoLiberacao}
                className="bg-navy text-navy-foreground hover:bg-navy-light"
              >
                {salvandoLiberacao ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {salvandoLiberacao ? "Salvando…" : "Salvar liberação"}
              </Button>
              {!result.id && (
                <p className="text-[11px] italic text-muted-foreground">
                  Análise antiga sem id persistido — não é possível salvar liberação.
                </p>
              )}
              {result.limiteAjustadoManualmente && result.justificativaAjuste && (
                <p className="rounded-md bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-900">
                  Liberação ajustada manualmente · Motivo: {result.justificativaAjuste}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Bottom actions */}
        <div className="mx-auto mt-6 flex max-w-md gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/historico")}>
            Ver Histórico
          </Button>
          <Button className="flex-1 bg-navy text-navy-foreground hover:bg-navy-light" onClick={() => navigate("/")}>
            Nova Análise
          </Button>
        </div>

        {/* Manual adjust dialog */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajustar Score Manualmente</DialogTitle>
              <DialogDescription>Registre uma justificativa para auditoria no relatório.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjustPoints">Ajuste de pontos (+/-)</Label>
                <Input id="adjustPoints" type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustJustification">Justificativa</Label>
                <Textarea id="adjustJustification" value={adjustJustification} onChange={(e) => setAdjustJustification(e.target.value)} placeholder="Descreva o motivo do ajuste manual" />
              </div>
              <Button className="w-full" onClick={handleManualAdjust}>Registrar ajuste</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bureau upload dialog */}
        <Dialog
          open={bureauModalOpen}
          onOpenChange={(v) => {
            if (bureauUploading) return;
            setBureauModalOpen(v);
            if (!v) {
              setBureauFile([]);
              setBureauProgress("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anexar relatório de bureau</DialogTitle>
              <DialogDescription>
                Os dados extraídos são puramente informativos e não alteram o score do titular.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Bureau</Label>
                <RadioGroup
                  value={bureauTipo}
                  onValueChange={(v) => setBureauTipo(v as BureauTipo)}
                  className="flex gap-6"
                  disabled={bureauUploading}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="serasa" id="b-serasa" />
                    <Label htmlFor="b-serasa" className="cursor-pointer font-normal">
                      Serasa
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="boa_vista" id="b-bv" />
                    <Label htmlFor="b-bv" className="cursor-pointer font-normal">
                      Boa Vista
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <FileDropzone
                label="Upload do relatório do bureau (1 PDF)"
                maxFiles={1}
                files={bureauFile}
                onFilesChange={setBureauFile}
              />

              {bureauUploading && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {bureauProgress || "Processando…"}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setBureauModalOpen(false)}
                disabled={bureauUploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadBureau}
                disabled={bureauUploading || bureauFile.length === 0}
              >
                {bureauUploading ? "Processando…" : "Extrair e salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <tr>
    <td style={{ padding: "3px 0", color: "#6b7280", width: "100px" }}>{label}</td>
    <td style={{ padding: "3px 0", fontWeight: 500 }}>{value}</td>
  </tr>
);

const SugestaoLinha = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

const formatarDataISO = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

const liberacaoDiferente = (
  result: ScoringResult,
  limiteInput: string,
  parcelasInput: string,
): boolean => {
  const limite = limiteInput.trim() === "" ? null : Number(limiteInput);
  const parcelas = parcelasInput.trim() === "" ? null : Number(parcelasInput);
  const diffLimite = limite !== (result.limiteSugerido ?? null);
  const diffParcelas = parcelas !== (result.parcelasSugeridas ?? null);
  return diffLimite || diffParcelas;
};

const Linha = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

const BureauResumo = ({ bureau }: { bureau: Bureau }) => {
  const d = bureau.dados_extraidos || ({} as Bureau["dados_extraidos"]);
  const restritivosLinhas: { label: string; quantidade: number | null; valor: number | null }[] = [
    { label: "Pefin", quantidade: d.pefin?.quantidade ?? null, valor: d.pefin?.valor_total ?? null },
    { label: "Refin", quantidade: d.refin?.quantidade ?? null, valor: d.refin?.valor_total ?? null },
    {
      label: "Protestos",
      quantidade: d.protestos?.quantidade ?? null,
      valor: d.protestos?.valor_total ?? null,
    },
    {
      label: "Ações judiciais",
      quantidade: d.acoes_judiciais?.quantidade ?? null,
      valor: d.acoes_judiciais?.valor_total ?? null,
    },
    {
      label: "CCF (cheques)",
      quantidade: d.ccf_cheques_sem_fundo?.quantidade ?? null,
      valor: d.ccf_cheques_sem_fundo?.valor_total ?? null,
    },
  ];

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold uppercase">
          {bureau.bureau === "serasa" ? "Serasa" : "Boa Vista"}
        </span>
        {d.data_consulta && (
          <span className="text-[11px] text-muted-foreground">{d.data_consulta}</span>
        )}
      </div>

      {(d.nome_consultado || d.documento_consultado) && (
        <div>
          <p className="truncate text-xs font-medium text-foreground">
            {d.nome_consultado || "—"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {d.documento_consultado || "—"}
          </p>
        </div>
      )}

      {(d.score_valor !== null || d.score_classificacao) && (
        <div className="rounded-md border bg-background p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Score do bureau</p>
          <p className="text-2xl font-bold text-foreground">{fmtNumber(d.score_valor)}</p>
          {d.score_classificacao && (
            <p className="text-xs text-muted-foreground">{d.score_classificacao}</p>
          )}
          {typeof d.probabilidade_inadimplencia === "number" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Prob. inadimplência: {d.probabilidade_inadimplencia}%
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[10px] uppercase text-muted-foreground">Restrições</p>
        {restritivosLinhas.map((l) => (
          <Linha
            key={l.label}
            label={l.label}
            value={`${fmtNumber(l.quantidade)} · ${fmtMoney(l.valor)}`}
          />
        ))}
      </div>

      {d.consultas_recentes && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-muted-foreground">Consultas recentes</p>
          <Linha label="Últimos 30 dias" value={fmtNumber(d.consultas_recentes.ultimos_30_dias)} />
          <Linha label="Últimos 90 dias" value={fmtNumber(d.consultas_recentes.ultimos_90_dias)} />
          <Linha label="Últimos 180 dias" value={fmtNumber(d.consultas_recentes.ultimos_180_dias)} />
        </div>
      )}

      {bureau.pdf_filename && (
        <p className="truncate text-[10px] text-muted-foreground">
          Arquivo: {bureau.pdf_filename}
        </p>
      )}
    </div>
  );
};

export default Resultado;
