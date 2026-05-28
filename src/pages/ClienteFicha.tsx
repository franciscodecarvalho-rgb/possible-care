import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, FileSearch, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  obterCliente, listarAnalisesDoCliente, getStatusInfo, maskDocumento,
  type Cliente,
} from "@/lib/clienteService";

const ClienteFicha = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [analises, setAnalises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    Promise.all([obterCliente(id), listarAnalisesDoCliente(id)])
      .then(([c, a]) => {
        if (!active) return;
        if (!c) {
          toast.error("Cliente não encontrado");
          navigate("/clientes");
          return;
        }
        setCliente(c);
        setAnalises(a);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, navigate]);

  if (loading || !cliente) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-10 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </main>
      </div>
    );
  }

  const status = getStatusInfo(cliente.status);
  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-6 py-10">
        <BackButton to="/clientes" />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{cliente.nome}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">{cliente.tipo}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${status.cor}`}>
                {status.label}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{maskDocumento(cliente.documento, cliente.tipo)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
              <Pencil className="h-4 w-4" /> Editar cliente
            </Button>
            <Button onClick={() => navigate(cliente.tipo === "pf" ? "/analise/pf" : "/analise/pj")}>
              <FileSearch className="h-4 w-4" /> Nova análise
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
            <div className="grid grid-cols-2 gap-4">
              {cliente.tipo === "pf" ? (
                <>
                  <Field label="Data de nascimento" value={cliente.data_nascimento && new Date(cliente.data_nascimento).toLocaleDateString("pt-BR")} />
                  <Field label="RG" value={cliente.rg} />
                  <Field label="Ocupação" value={cliente.ocupacao} />
                </>
              ) : (
                <>
                  <Field label="Nome fantasia" value={cliente.nome_fantasia} />
                  <Field label="Data de fundação" value={cliente.data_fundacao && new Date(cliente.data_fundacao).toLocaleDateString("pt-BR")} />
                  <Field label="Porte" value={cliente.porte} />
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Contato</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" value={cliente.email} />
              <Field label="Telefone" value={cliente.telefone} />
            </div>
          </section>

          <section className="md:col-span-2 rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Endereço</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="CEP" value={cliente.endereco_cep} />
              <Field label="Rua" value={cliente.endereco_rua} />
              <Field label="Número" value={cliente.endereco_numero} />
              <Field label="Complemento" value={cliente.endereco_complemento} />
              <Field label="Bairro" value={cliente.endereco_bairro} />
              <Field label="Cidade" value={cliente.endereco_cidade} />
              <Field label="UF" value={cliente.endereco_uf} />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border bg-card overflow-x-auto">
          <div className="p-6 pb-3">
            <h2 className="text-sm font-semibold text-foreground">Histórico de análises deste cliente</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>Decisão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analises.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-6 w-6" />
                      <span>Nenhuma análise para este cliente ainda.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                analises.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate("/resultado", {
                        state: {
                          extractedData: a.extracted_data,
                          tipo: a.tipo,
                          formData: a.form_data,
                          fromHistory: {
                            protocolo: a.protocolo,
                            score: a.score,
                            decision: a.decision,
                            decisionColor: a.decision_color,
                            breakdown: a.breakdown,
                            data: a.data,
                            tipo: a.tipo,
                            extractedData: a.extracted_data,
                            formData: a.form_data,
                            manualAdjustment: a.manual_adjustment,
                            scoreOriginal: a.score_original,
                          },
                        },
                      })
                    }
                  >
                    <TableCell className="text-sm whitespace-nowrap">{new Date(a.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{a.protocolo}</TableCell>
                    <TableCell className="text-center font-semibold">{a.score}</TableCell>
                    <TableCell>
                      <span className="inline-block rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: a.decision_color }}>
                        {a.decision}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {cliente.observacoes && (
          <section className="mt-6 rounded-lg border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-2">Observações</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cliente.observacoes}</p>
          </section>
        )}
      </main>
    </div>
  );
};

export default ClienteFicha;
