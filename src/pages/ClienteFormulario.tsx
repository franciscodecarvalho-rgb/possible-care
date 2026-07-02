import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  obterCliente, criarCliente, atualizarCliente,
  STATUS_CLIENTE, UFS, maskCEP, maskTelefone, maskDocumento,
  validarDocumento,
  type ClienteInput, type TipoCliente,
} from "@/lib/clienteService";

const empty: ClienteInput = {
  tipo: "pf",
  nome: "",
  documento: "",
  email: null, telefone: null,
  endereco_rua: null, endereco_numero: null, endereco_complemento: null,
  endereco_bairro: null, endereco_cidade: null, endereco_uf: null, endereco_cep: null,
  observacoes: null,
  data_nascimento: null, rg: null, ocupacao: null,
  nome_fantasia: null, data_fundacao: null, porte: null,
  status: "prospect",
};

const ClienteFormulario = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const editMode = !!id;

  const [form, setForm] = useState<ClienteInput>(empty);
  const [loading, setLoading] = useState(editMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editMode) return;
    setLoading(true);
    obterCliente(id!)
      .then((c) => {
        if (!c) {
          toast.error("Cliente não encontrado");
          navigate("/clientes");
          return;
        }
        const { id: _i, created_by: _c, created_at: _ca, updated_at: _u, ...rest } = c;
        setForm(rest as ClienteInput);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id, editMode, navigate]);

  const set = <K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const setStr = (k: keyof ClienteInput, v: string) =>
    set(k, (v.trim() === "" ? null : v) as any);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!form.documento.trim()) return toast.error("Documento é obrigatório");
    if (!validarDocumento(form.documento, form.tipo))
      return toast.error(form.tipo === "pf" ? "CPF inválido — confira os dígitos" : "CNPJ inválido — confira os dígitos");
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      return toast.error("Email inválido");

    setSaving(true);
    try {
      const saved = editMode
        ? await atualizarCliente(id!, form)
        : await criarCliente(form);
      toast.success("Cliente salvo");
      navigate(`/clientes/${saved.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-10 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </main>
      </div>
    );
  }

  const isPF = form.tipo === "pf";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-6 py-10">
        <BackButton to={editMode ? `/clientes/${id}` : "/clientes"} />
        <h1 className="text-2xl font-bold text-foreground">
          {editMode ? "Editar cliente" : "Novo cliente"}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          {/* Seção 1 */}
          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Identificação</h2>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio" name="tipo" value="pf"
                  checked={form.tipo === "pf"} disabled={editMode}
                  onChange={() => set("tipo", "pf")}
                /> Pessoa Física
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio" name="tipo" value="pj"
                  checked={form.tipo === "pj"} disabled={editMode}
                  onChange={() => set("tipo", "pj")}
                /> Pessoa Jurídica
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{isPF ? "Nome" : "Razão social"} *</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>{isPF ? "CPF" : "CNPJ"} *</Label>
                <Input
                  value={maskDocumento(form.documento, form.tipo)}
                  onChange={(e) => set("documento", e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
            </div>

            {isPF ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => setStr("data_nascimento", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>RG</Label>
                  <Input value={form.rg ?? ""} onChange={(e) => setStr("rg", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Ocupação</Label>
                  <Input value={form.ocupacao ?? ""} onChange={(e) => setStr("ocupacao", e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Nome fantasia</Label>
                  <Input value={form.nome_fantasia ?? ""} onChange={(e) => setStr("nome_fantasia", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Data de fundação</Label>
                  <Input type="date" value={form.data_fundacao ?? ""} onChange={(e) => setStr("data_fundacao", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Porte</Label>
                  <Select value={form.porte ?? ""} onValueChange={(v) => set("porte", v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {["MEI","ME","EPP","Médio","Grande"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          {/* Seção 2 */}
          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Contato</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setStr("email", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone ?? ""}
                  onChange={(e) => setStr("telefone", maskTelefone(e.target.value))}
                />
              </div>
            </div>
          </section>

          {/* Seção 3 */}
          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Endereço</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>CEP</Label>
                <Input value={form.endereco_cep ?? ""} onChange={(e) => setStr("endereco_cep", maskCEP(e.target.value))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Rua</Label>
                <Input value={form.endereco_rua ?? ""} onChange={(e) => setStr("endereco_rua", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Número</Label>
                <Input value={form.endereco_numero ?? ""} onChange={(e) => setStr("endereco_numero", e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Complemento</Label>
                <Input value={form.endereco_complemento ?? ""} onChange={(e) => setStr("endereco_complemento", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={form.endereco_bairro ?? ""} onChange={(e) => setStr("endereco_bairro", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input value={form.endereco_cidade ?? ""} onChange={(e) => setStr("endereco_cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>UF</Label>
                <Select value={form.endereco_uf ?? ""} onValueChange={(v) => set("endereco_uf", v || null)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Seção 4 */}
          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Status no funil</h2>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="md:w-80"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_CLIENTE.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Seção 5 */}
          <section className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Observações</h2>
            <Textarea rows={4} value={form.observacoes ?? ""} onChange={(e) => setStr("observacoes", e.target.value)} />
          </section>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(editMode ? `/clientes/${id}` : "/clientes")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ClienteFormulario;
