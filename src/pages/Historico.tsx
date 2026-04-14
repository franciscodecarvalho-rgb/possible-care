import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, Eye } from "lucide-react";
import type { ScoringResult } from "@/lib/creditScoring";

const columns = ["Data", "Protocolo", "Tipo", "Score", "Decisão", "Ações"];

const Historico = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ScoringResult[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("credit_history");
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground">Histórico de Análises</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte as análises de crédito realizadas
        </p>

        <div className="mt-8 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <span>Nenhuma análise realizada ainda</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                history.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      {new Date(r.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{r.protocolo}</TableCell>
                    <TableCell className="text-sm uppercase">{r.tipo}</TableCell>
                    <TableCell className="text-sm font-semibold">{r.score}</TableCell>
                    <TableCell>
                      <span
                        className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white"
                        style={{ backgroundColor: r.decisionColor }}
                      >
                        {r.decision}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate("/resultado", {
                            state: {
                              extractedData: r.extractedData,
                              tipo: r.tipo,
                              formData: r.formData,
                              fromHistory: r,
                            },
                          })
                        }
                      >
                        <Eye className="mr-1 h-4 w-4" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default Historico;
