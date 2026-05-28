import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  ShieldOff,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  gerarChave,
  listarChaves,
  revogarChave,
  listarConsultas,
  type ApiKey,
  type ConsultaApi,
} from "@/lib/apiKeyService";

const PAGE_SIZE = 50;

const ApiKeysContent = () => {
  const [chaves, setChaves] = useState<ApiKey[]>([]);
  const [loadingChaves, setLoadingChaves] = useState(true);
  const [gerarModalOpen, setGerarModalOpen] = useState(false);
  const [nomeNova, setNomeNova] = useState("");
  const [gerando, setGerando] = useState(false);
  const [chaveGeradaPlain, setChaveGeradaPlain] = useState<string | null>(null);

  const [consultas, setConsultas] = useState<ConsultaApi[]>([]);
  const [loadingConsultas, setLoadingConsultas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [filtroKey, setFiltroKey] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  const reloadChaves = async () => {
    setLoadingChaves(true);
    try {
      setChaves(await listarChaves());
    } catch (e: any) {
      toast.error(e?.message || "Erro ao listar chaves.");
    } finally {
      setLoadingChaves(false);
    }
  };

  const reloadConsultas = async () => {
    setLoadingConsultas(true);
    try {
      const filtros: any = {
        pageSize: PAGE_SIZE,
        offset: pagina * PAGE_SIZE,
      };
      if (filtroKey !== "todas") filtros.apiKeyId = filtroKey;
      if (filtroStatus !== "todos") filtros.statusHttp = Number(filtroStatus);
      if (filtroDe) filtros.de = new Date(filtroDe).toISOString();
      if (filtroAte) {
        const ate = new Date(filtroAte);
        ate.setHours(23, 59, 59, 999);
        filtros.ate = ate.toISOString();
      }
      setConsultas(await listarConsultas(filtros));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao listar consultas.");
    } finally {
      setLoadingConsultas(false);
    }
  };

  useEffect(() => {
    reloadChaves();
  }, []);

  useEffect(() => {
    reloadConsultas();
  }, [pagina, filtroKey, filtroStatus, filtroDe, filtroAte]);

  const handleGerar = async () => {
    if (!nomeNova.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setGerando(true);
    try {
      const result = await gerarChave(nomeNova.trim());
      setChaveGeradaPlain(result.apiKey);
      setNomeNova("");
      reloadChaves();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar chave.");
    } finally {
      setGerando(false);
    }
  };

  const handleCopiar = async () => {
    if (!chaveGeradaPlain) return;
    try {
      await navigator.clipboard.writeText(chaveGeradaPlain);
      toast.success("Chave copiada para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  const handleRevogar = async (id: string) => {
    try {
      await revogarChave(id);
      toast.success("Chave revogada.");
      reloadChaves();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao revogar chave.");
    }
  };

  const chavesMap = useMemo(() => {
    const m = new Map<string, ApiKey>();
    for (const c of chaves) m.set(c.id, c);
    return m;
  }, [chaves]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-6xl px-6 py-8">
        <BackButton to="/" />
        <h1 className="text-2xl font-bold text-foreground">Chaves de API</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestão das chaves usadas pelo CRM Vitatech para consultar análises.
        </p>

        <Tabs defaultValue="chaves" className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="chaves">Chaves</TabsTrigger>
            <TabsTrigger value="logs">Logs de consulta</TabsTrigger>
          </TabsList>

          <TabsContent value="chaves" className="mt-6 space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setNomeNova("");
                  setChaveGeradaPlain(null);
                  setGerarModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Gerar nova chave
              </Button>
            </div>

            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Prefixo</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead>Última uso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingChaves && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingChaves && chaves.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                        Nenhuma chave gerada ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingChaves &&
                    chaves.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.prefixo}
                          <span className="text-muted-foreground">…</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.criada_em).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.ultima_uso
                            ? new Date(c.ultima_uso).toLocaleString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {c.ativa ? (
                            <Badge className="bg-emerald-600">ativa</Badge>
                          ) : (
                            <Badge variant="secondary">revogada</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.ativa && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <ShieldOff className="mr-1 h-4 w-4" /> Revogar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revogar chave “{c.nome}”?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A chave deixa de funcionar imediatamente. A operação é
                                    irreversível — para reativar acesso é preciso gerar uma chave nova.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRevogar(c.id)}>
                                    Revogar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-6 space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <Select value={filtroKey} onValueChange={(v) => { setFiltroKey(v); setPagina(0); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {chaves.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.prefixo}…)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status HTTP</Label>
                  <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPagina(0); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="400">400</SelectItem>
                      <SelectItem value="401">401</SelectItem>
                      <SelectItem value="404">404</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={filtroDe}
                    onChange={(e) => { setFiltroDe(e.target.value); setPagina(0); }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={filtroAte}
                    onChange={(e) => { setFiltroAte(e.target.value); setPagina(0); }}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={reloadConsultas}>
                  <RefreshCcw className="mr-1 h-4 w-4" /> Atualizar
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingConsultas && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingConsultas && consultas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                        Nenhuma consulta encontrada com esses filtros.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingConsultas &&
                    consultas.map((c) => {
                      const k = c.api_key_id ? chavesMap.get(c.api_key_id) : null;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(c.consultada_em).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{c.protocolo}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                c.status_http >= 200 && c.status_http < 300
                                  ? "bg-emerald-600"
                                  : c.status_http >= 400 && c.status_http < 500
                                    ? "bg-yellow-600"
                                    : "bg-destructive"
                              }
                            >
                              {c.status_http}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {k ? `${k.prefixo}… (${k.nome})` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{c.ip_origem || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {pagina + 1} · {consultas.length} resultado(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={pagina === 0 || loadingConsultas}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={consultas.length < PAGE_SIZE || loadingConsultas}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal gerar nova chave */}
      <Dialog
        open={gerarModalOpen}
        onOpenChange={(v) => {
          if (gerando) return;
          setGerarModalOpen(v);
          if (!v) {
            setNomeNova("");
            setChaveGeradaPlain(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {chaveGeradaPlain ? "Chave gerada com sucesso" : "Gerar nova chave"}
            </DialogTitle>
            <DialogDescription>
              {chaveGeradaPlain
                ? "Copie a chave agora — ela não será mostrada novamente. Apenas o hash fica armazenado no banco."
                : "Use um nome descritivo para identificar quem vai consumir a chave."}
            </DialogDescription>
          </DialogHeader>

          {!chaveGeradaPlain && (
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nomeNova}
                onChange={(e) => setNomeNova(e.target.value)}
                placeholder="Ex: CRM Vitatech — Produção"
                disabled={gerando}
              />
            </div>
          )}

          {chaveGeradaPlain && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-700" />
                <p className="text-xs text-yellow-900">
                  Esta chave não será mostrada novamente. Guarde-a em um cofre de senhas (Vault,
                  1Password, etc) antes de fechar este modal.
                </p>
              </div>
              <div className="rounded-md border bg-muted/50 p-3 font-mono text-xs break-all">
                {chaveGeradaPlain}
              </div>
              <Button variant="outline" onClick={handleCopiar}>
                <Copy className="mr-2 h-4 w-4" /> Copiar chave
              </Button>
            </div>
          )}

          <DialogFooter>
            {!chaveGeradaPlain ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setGerarModalOpen(false)}
                  disabled={gerando}
                >
                  Cancelar
                </Button>
                <Button onClick={handleGerar} disabled={gerando || !nomeNova.trim()}>
                  {gerando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Gerar
                </Button>
              </>
            ) : (
              <Button onClick={() => setGerarModalOpen(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ApiKeys = () => {
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
            Apenas administradores podem gerenciar chaves de API
          </h1>
          <BackButton to="/" />
        </main>
      </div>
    );
  }

  return <ApiKeysContent />;
};

export default ApiKeys;
