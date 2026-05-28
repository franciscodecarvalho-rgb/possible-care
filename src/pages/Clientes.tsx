import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listarClientes, STATUS_CLIENTE, getStatusInfo, maskDocumento,
  type Cliente, type TipoCliente,
} from "@/lib/clienteService";

const Clientes = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listarClientes({
      busca: buscaDebounced,
      status: filterStatus,
      tipo: filterTipo as TipoCliente | "todos",
    })
      .then((data) => active && setClientes(data))
      .catch((e) => toast.error(e.message ?? "Erro ao carregar clientes"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [buscaDebounced, filterStatus, filterTipo]);

  const temFiltros = useMemo(
    () => !!buscaDebounced || filterStatus !== "todos" || filterTipo !== "todos",
    [buscaDebounced, filterStatus, filterTipo]
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-10">
        <BackButton to="/" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cadastro e funil de clientes</p>
          </div>
          <Button onClick={() => navigate("/clientes/novo")}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <Input
              placeholder="Nome ou documento"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_CLIENTE.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pf">Pessoa Física</SelectItem>
                <SelectItem value="pj">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                    </div>
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-8 w-8" />
                      <span>
                        {temFiltros
                          ? "Nenhum cliente encontrado com esses filtros."
                          : "Nenhum cliente ainda. Clique em Novo cliente."}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((c) => {
                  const status = getStatusInfo(c.status);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/clientes/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {maskDocumento(c.documento, c.tipo)}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">
                          {c.tipo}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold text-white ${status.cor}`}>
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{c.telefone ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground text-right">
          {clientes.length} cliente(s)
        </p>
      </main>
    </div>
  );
};

export default Clientes;
