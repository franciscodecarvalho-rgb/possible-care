import { useState, useEffect, useRef } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Inbox, Eye, Download, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { ScoringResult } from "@/lib/creditScoring";

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

  // Filters
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterDecisao, setFilterDecisao] = useState("todos");
  const [filterDe, setFilterDe] = useState("");
  const [filterAte, setFilterAte] = useState("");

  // Delete dialog
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("credit_history");
    if (raw) {
      const parsed = JSON.parse(raw) as ScoringResult[];
      setHistory(parsed);
    }
  }, []);

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

  const handleDelete = () => {
    if (deleteIdx === null) return;
    const item = filteredHistory[deleteIdx];
    const newHistory = history.filter((r) => r.protocolo !== item.protocolo);
    localStorage.setItem("credit_history", JSON.stringify(newHistory));
    setHistory(newHistory);
    setDeleteIdx(null);
    toast.success("Análise excluída.");
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground">Histórico de Análises</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte as análises de crédito realizadas
        </p>

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

        {/* Table */}
        <div className="mt-6 rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <span>{history.length === 0 ? "Nenhuma análise realizada ainda" : "Nenhum resultado com esses filtros"}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((r, i) => {
                  const nome = r.extractedData?.nome_completo || r.extractedData?.razao_social || r.extractedData?.representante?.nome || "—";
                  return (
                    <TableRow key={r.protocolo + i}>
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
                          <Button variant="ghost" size="sm" onClick={() => setDeleteIdx(i)} title="Excluir"
                            className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
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
          {filteredHistory.length} de {history.length} análise(s)
        </p>
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={deleteIdx !== null} onOpenChange={(open) => !open && setDeleteIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O relatório será removido permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Historico;
