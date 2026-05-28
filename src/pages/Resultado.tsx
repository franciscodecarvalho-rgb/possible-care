import { useLocation, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, SlidersHorizontal } from "lucide-react";
import BackButton from "@/components/BackButton";
import { useEffect, useRef, useState } from "react";
import { scorePF, scorePJ, type ScoringResult } from "@/lib/creditScoring";
import { generateAnalysis } from "@/lib/reportAnalysis";
import { saveHistoryResult, updateHistoryResult } from "@/lib/historyService";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  const extractedData = location.state?.extractedData as Record<string, any> | undefined;
  const tipo = (location.state?.tipo as string) || "pf";
  const formData = location.state?.formData as { valor: number; prazo: number; finalidade: string } | undefined;

  useEffect(() => {
    if (location.state?.fromHistory) {
      setResult(location.state.fromHistory as ScoringResult);
      return;
    }
    if (!extractedData || !formData) return;
    if (tipo === "pf") {
      const r = scorePF(extractedData, formData.valor, formData.prazo, formData.finalidade);
      setResult(r);
    } else if (tipo === "pj") {
      const r = scorePJ(extractedData, formData.valor, formData.prazo, formData.finalidade);
      setResult(r);
    }
  }, []);

  // Auto-export when coming from history with autoExport flag
  useEffect(() => {
    if (result && location.state?.autoExport && reportRef.current) {
      const timer = setTimeout(() => handleExportPDF(), 600);
      return () => clearTimeout(timer);
    }
  }, [result]);

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

  const handleManualAdjust = () => {
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
      manualAdjustment: { points: adjustPoints, justification: adjustJustification.trim(), adjustedAt: new Date().toISOString() },
    };
    setResult(next);
    persistHistory(loadHistory().map((item) => item.protocolo === next.protocolo ? next : item));
    setAdjustOpen(false);
    toast.success("Ajuste manual registrado no relatório.");
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

  return (
    <div className="min-h-screen bg-muted">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-8">
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

        {/* A4 Sheet */}
        <div
          ref={reportRef}
          className="mx-auto bg-white shadow-xl"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "15mm",
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            color: "#1a1a2e",
            fontSize: "11px",
            lineHeight: "1.5",
          }}
        >
          {/* HEADER */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #1e3a5f", paddingBottom: "10px", marginBottom: "16px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "1px", margin: 0, color: "#1e3a5f" }}>
              RELATÓRIO DE ANÁLISE DE CRÉDITO
            </h1>
            <p style={{ fontSize: "10px", color: "#6b7280", marginTop: "6px" }}>
              Data: {fmtDate(result.data)} &nbsp;|&nbsp; Protocolo: {result.protocolo} &nbsp;|&nbsp; Tipo: {tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
            </p>
          </div>

          {/* BLOCO 1 — SCORE */}
          <div style={{ textAlign: "center", padding: "16px 0", marginBottom: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#6b7280", margin: 0 }}>
              Score de Crédito
            </p>
            <p style={{ fontSize: "48px", fontWeight: 800, color: result.decisionColor, margin: "4px 0 0 0", lineHeight: 1.1 }}>
              {result.score} <span style={{ fontSize: "18px", fontWeight: 400, color: "#9ca3af" }}>/ 1000</span>
            </p>
            {/* Progress bar */}
            <div style={{ maxWidth: "400px", margin: "12px auto 0", background: "#e5e7eb", borderRadius: "6px", height: "10px", overflow: "hidden" }}>
              <div style={{ width: `${(result.score / 1000) * 100}%`, height: "100%", borderRadius: "6px", background: result.decisionColor, transition: "width 0.5s" }} />
            </div>
            {/* Decision badge */}
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

          {/* BLOCO 2 — IDENTIFICAÇÃO */}
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

          {/* BLOCO 3 — RESUMO ANALÍTICO */}
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

          {/* BLOCO 4 — TABELA DE SCORE */}
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

          {/* RODAPÉ */}
          <div style={{ marginTop: "24px", borderTop: "1px solid #d1d5db", paddingTop: "10px", textAlign: "center" }}>
            <p style={{ fontSize: "8px", color: "#9ca3af", margin: 0 }}>
              Este relatório constitui ferramenta auxiliar de análise. A decisão final sobre a concessão de crédito é de exclusiva responsabilidade do analista.
            </p>
            <p style={{ fontSize: "8px", color: "#9ca3af", marginTop: "2px" }}>
              Analisador de Crédito - POSSIBLE &nbsp;|&nbsp; {fmtDate(result.data)}
            </p>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="mx-auto mt-6 flex max-w-md gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/historico")}>
            Ver Histórico
          </Button>
          <Button className="flex-1 bg-navy text-navy-foreground hover:bg-navy-light" onClick={() => navigate("/")}>
            Nova Análise
          </Button>
        </div>

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

export default Resultado;
