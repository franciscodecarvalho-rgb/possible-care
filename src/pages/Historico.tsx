import Header from "@/components/Header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Inbox } from "lucide-react";

const columns = ["Data", "Protocolo", "Nome", "Tipo", "Score", "Decisão", "Ações"];

const Historico = () => (
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
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Inbox className="h-8 w-8" />
                  <span>Nenhuma análise realizada ainda</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </main>
  </div>
);

export default Historico;
