import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Inbox, Eye, Download, Filter, GitCompare, Loader2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";
import type { ScoringResult } from "@/lib/creditScoring";
import { loadHistory } from "@/lib/historyService";
import MigracaoLocalStorage from "@/components/MigracaoLocalStorage";

const decisionOptions = [
  "CRÉDITO APROVADO",
  "APROVADO COM RESSALVAS",
  "CRÉDITO REPROVADO",
  "CRÉDITO REPROVADO — RISCO ELEVADO",
  "ANÁLISE INCONCLUSIVA — DADOS INSUFICIENTES",
];

const Historico = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ScoringResult[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ScoringResult[]>([]);
  const [compareProtocols, setCompareProtocols] = useState<string[]>([]);

  // Filters
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterDecisao, setFilterDecisao] = useState("todos");
  const [filterDe, setFilterDe] = useState("");
  const [filterAte, setFilterAte] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadHistory();
      setHistory(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    let list = [...history];
    if (filterTipo !== "todos") list = list.filter((r) => r.tipo === filterTipo);
    if (filterDecisao !== "todos") list = list.filter((r) => r.decision === filterDecisao);
    if (filterDe) {
      const de = new Date(filterDe);
      list = list.filter((r) => new Date(r.data) >= de);
    }
    if (filterAte) {
      const ate = new Date(filterAte);
      ate.setHours(23, 59, 59);
      list = list.filter((r) => new Date(r.data) <= ate);
    }
    setFilteredHistory(list);
  }, [history, filterTipo, filterDecisao, filterDe, filterAte]);

  const handleView = (r: ScoringResult) => {
    navigate("/resultado", {
      state: {
        extractedData: r.extractedData,
        tipo: r.tipo,
        formData: r.formData,
        fromHistory: r,
      },
    });
  };

  const handleExportPDF = async (r: ScoringResult) => {
    // Navigate to resultado and let it handle PDF — or replicate inline
    // For direct export we re-navigate with a flag
    navigate("/resultado", {
      state: {
        extractedData: r.extractedData,
        tipo: r.tipo,
        formData: r.formData,
        fromHistory: r,
        autoExport: true,
      },
    });
  };

  const clearFilters = () => {
    setFilterTipo("todos");
    setFilterDecisao("todos");
    setFilterDe("");
    setFilterAte("");
  };

  const hasFilters = filterTipo !== "todos" || filterDecisao !== "todos" || filterDe || filterAte;
  const metrics = {
    total: history.length,
    aprovadas: history.length ? Math.round((history.filter(r => r.decision === "CRÉDITO APROVADO").length / history.length) * 100) : 0,
    ressalvas: history.length ? Math.round((history.filter(r => r.decision === "APROVADO COM RESSALVAS").length / history.length) * 100) : 0,
    reprovadas: history.length ? Math.round((history.filter(r => r.decision.includes("REPROVADO")).length / history.length) * 100) : 0,
    scoreMedio: history.length ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length) : 0,
  };
  const compareItems = compareProtocols.map((p) => history.find((r) => r.protocolo === p)).filter(Boolean) as ScoringResult[];
  const getNome = (r: ScoringResult) => r.extractedData?.nome_completo || r.extractedData?.razao_social || r.extractedData?.representante?.nome || "—";
  const toggleCompare = (protocolo: string) => {
    setCompareProtocols(prev => prev.includes(protocolo) ? prev.filter(p => p !== protocolo) : prev.length < 2 ? [...prev, protocolo] : [prev[1], protocolo]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-10">
        <BackButton to="/" />
        <h1 className="text-2xl font-bold text-foreground">Histórico de Análises</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte as análises de crédito realizadas
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total", metrics.total],
            ["% Aprovadas", `${metrics.aprovadas}%`],
            ["% Ressalvas", `${metrics.ressalvas}%`],
            ["% Reprovadas", `${metrics.reprovadas}%`],
            ["Score médio", metrics.scoreMedio],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Decisão</Label>
              <Select value={filterDecisao} onValueChange={setFilterDecisao}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {decisionOptions.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" className="h-9" value={filterDe} onChange={(e) => setFilterDe(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" className="h-9" value={filterAte} onChange={(e) => setFilterAte(e.target.value)} />
            </div>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>

        {compareItems.length === 2 && (
          <div className="mt-6 rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <GitCompare className="h-4 w-4" /> Comparativo entre análises
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {compareItems.map((item) => (
                <div key={item.protocolo} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{getNome(item)}</p>
                      <p className="text-xs text-muted-foreground">{item.protocolo}</p>
                    </div>
                    <span className="text-2xl font-bold" style={{ color: item.decisionColor }}>{item.score}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {item.breakdown.map((b) => (
                      <div key={b.category} className="flex justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{b.category}</span>
                        <span className="font-medium text-foreground">{b.points}/{b.maxPoints}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="mt-6 rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead>Comparar</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Decisão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <span>{history.length === 0 ? "Nenhuma análise realizada ainda" : "Nenhum resultado com esses filtros"}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((r, i) => {
                  const nome = getNome(r);
                  return (
                    <TableRow key={r.protocolo + i}>
                      <TableCell>
                        <Button variant={compareProtocols.includes(r.protocolo) ? "default" : "outline"} size="sm" onClick={() => toggleCompare(r.protocolo)}>
                          <GitCompare className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(r.data).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{r.protocolo}</TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">{nome}</TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">
                          {r.tipo}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm font-semibold">{r.score}</TableCell>
                      <TableCell>
                        <span
                          className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white whitespace-nowrap"
                          style={{ backgroundColor: r.decisionColor }}
                        >
                          {r.decision}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleView(r)} title="Ver relatório">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleExportPDF(r)} title="Exportar PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground text-right">
          {loading ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</span>
          ) : (
            <>{filteredHistory.length} de {history.length} análise(s)</>
          )}
        </p>
      </main>
    </div>
  );
};
  );
};

export default Historico;
