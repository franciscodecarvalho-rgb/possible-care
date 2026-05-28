import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Loader2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";
import { extractFromFiles } from "@/lib/extractionService";
import { IRPF_PROMPT, PJ_BALANCO_PROMPT, PJ_FATURAMENTO_PROMPT } from "@/lib/pdfExtractor";
import { loadConfig } from "@/lib/scoringConfig";
import { obterCliente, maskDocumento, type Cliente } from "@/lib/clienteService";

const AnaliseNova = () => {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const clienteId = search.get("cliente");

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [carregandoCliente, setCarregandoCliente] = useState(true);

  const defaultPrazo = String(loadConfig().financialParams.prazoPadrao || 24);
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState(defaultPrazo);

  const [uploadOption, setUploadOption] = useState<"balancos" | "faturamento">("balancos");
  const [irpfFiles, setIrpfFiles] = useState<File[]>([]);
  const [balancosFiles, setBalancosFiles] = useState<File[]>([]);
  const [faturamentoFiles, setFaturamentoFiles] = useState<File[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  useEffect(() => {
    if (!clienteId) {
      toast.error("Selecione um cliente para iniciar a análise.");
      navigate("/", { replace: true });
      return;
    }
    let alive = true;
    obterCliente(clienteId)
      .then((c) => {
        if (!alive) return;
        if (!c) {
          toast.error("Cliente não encontrado.");
          navigate("/", { replace: true });
          return;
        }
        setCliente(c);
      })
      .catch((e) => toast.error(e?.message || "Erro ao carregar cliente."))
      .finally(() => alive && setCarregandoCliente(false));
    return () => {
      alive = false;
    };
  }, [clienteId, navigate]);

  const tipo = (cliente?.tipo ?? "pf") as "pf" | "pj";

  const validate = () => {
    const e: Record<string, string> = {};
    const v = parseFloat(valor);
    if (!valor || isNaN(v) || v <= 0) e.valor = "Informe um valor maior que zero.";
    if (!prazo || parseInt(prazo) <= 0) e.prazo = "Informe um prazo válido.";
    if (tipo === "pf") {
      if (irpfFiles.length === 0) e.irpf = "Envie a declaração IRPF.";
    } else {
      if (uploadOption === "balancos" && balancosFiles.length === 0)
        e.balancos = "Envie os balanços patrimoniais (até 3 PDFs).";
      if (uploadOption === "faturamento" && faturamentoFiles.length === 0)
        e.faturamento = "Envie o relatório de faturamento.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!cliente) return;
    if (!validate()) {
      toast.error("Corrija os campos destacados.");
      return;
    }

    setLoading(true);
    try {
      let extractedData: Record<string, any>;
      if (tipo === "pf") {
        const extracted = await extractFromFiles(irpfFiles, IRPF_PROMPT, setProgressMsg);
        extractedData = {
          ...extracted,
          nome_completo: cliente.nome,
          cpf: cliente.documento,
        };
      } else if (uploadOption === "balancos") {
        const balancoData = await extractFromFiles(balancosFiles, PJ_BALANCO_PROMPT, setProgressMsg);
        extractedData = {
          balancos: balancoData,
          pjDocType: "balancos",
          razao_social: cliente.nome,
          nome_completo: cliente.nome,
          cnpj: cliente.documento,
        };
      } else {
        const faturamentoData = await extractFromFiles(faturamentoFiles, PJ_FATURAMENTO_PROMPT, setProgressMsg);
        extractedData = {
          faturamento: faturamentoData,
          pjDocType: "faturamento",
          razao_social: cliente.nome,
          nome_completo: cliente.nome,
          cnpj: cliente.documento,
        };
      }

      navigate("/preview", {
        state: {
          extractedData,
          tipo,
          formData: { valor: parseFloat(valor), prazo: parseInt(prazo), finalidade: "" },
          clienteId: cliente.id,
        },
      });
    } catch (err: any) {
      console.error("AnaliseNova erro completo:", err);
      toast.error(err?.message || "Erro desconhecido no processamento.");
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  if (carregandoCliente || !cliente) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex max-w-2xl items-center gap-2 px-6 py-24 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cliente…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-6 py-10">
        <BackButton to={`/clientes/${cliente.id}`} />
        <h1 className="text-2xl font-bold text-foreground">Nova análise</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cliente selecionado: {cliente.nome} ({tipo.toUpperCase()})
        </p>

        <div className="mt-6 rounded-lg border bg-muted/40 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadOnly label={tipo === "pf" ? "Nome completo" : "Razão social"} value={cliente.nome} />
            <ReadOnly label={tipo === "pf" ? "CPF" : "CNPJ"} value={maskDocumento(cliente.documento, tipo)} />
            <ReadOnly label="Tipo" value={tipo === "pf" ? "Pessoa Física" : "Pessoa Jurídica"} />
            {tipo === "pf" && cliente.ocupacao && <ReadOnly label="Ocupação" value={cliente.ocupacao} />}
            {tipo === "pj" && cliente.nome_fantasia && <ReadOnly label="Nome fantasia" value={cliente.nome_fantasia} />}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor do crédito solicitado (R$)</Label>
            <Input
              id="valor"
              type="number"
              min="1"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={errors.valor ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.valor && <p className="text-xs text-destructive">{errors.valor}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prazo">Prazo desejado (meses)</Label>
            <Input
              id="prazo"
              type="number"
              min="1"
              placeholder="Ex: 24"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className={errors.prazo ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.prazo && <p className="text-xs text-destructive">{errors.prazo}</p>}
          </div>

          {tipo === "pf" ? (
            <div className="space-y-4 rounded-lg border bg-card p-5">
              <Label>Declaração IRPF</Label>
              <FileDropzone
                label="Upload da Declaração IRPF (1 PDF)"
                maxFiles={1}
                files={irpfFiles}
                onFilesChange={setIrpfFiles}
                error={errors.irpf}
              />
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border bg-card p-5">
              <Label>Documentos de comprovação</Label>
              <RadioGroup
                value={uploadOption}
                onValueChange={(v) => setUploadOption(v as "balancos" | "faturamento")}
                className="flex gap-6"
                disabled={loading}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="balancos" id="opt-balancos" />
                  <Label htmlFor="opt-balancos" className="cursor-pointer font-normal">
                    Balanços Patrimoniais
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="faturamento" id="opt-faturamento" />
                  <Label htmlFor="opt-faturamento" className="cursor-pointer font-normal">
                    Relatório de Faturamento
                  </Label>
                </div>
              </RadioGroup>

              {uploadOption === "balancos" ? (
                <FileDropzone
                  label="3 últimos Balanços Patrimoniais (até 3 PDFs)"
                  maxFiles={3}
                  files={balancosFiles}
                  onFilesChange={setBalancosFiles}
                  error={errors.balancos}
                />
              ) : (
                <FileDropzone
                  label="Relatório de Faturamento dos últimos 12 meses (1 PDF)"
                  maxFiles={1}
                  files={faturamentoFiles}
                  onFilesChange={setFaturamentoFiles}
                  error={errors.faturamento}
                />
              )}

              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs text-primary">
                  Documentos devem estar assinados pela administração e pelo contador com registro
                  ativo no CRC.
                </p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-navy text-navy-foreground hover:bg-navy-light"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {progressMsg || "Processando..."}
              </>
            ) : (
              "Extrair e analisar"
            )}
          </Button>
        </form>
      </main>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Processando análise</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              {["📄 Lendo documento...", "🤖 Extraindo dados...", "📊 Calculando score...", "✅ Gerando relatório..."].map(
                (step) => (
                  <div key={step} className="rounded-md border px-3 py-2 bg-muted/50 text-foreground">
                    {step}
                  </div>
                ),
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{progressMsg || "Iniciando processamento..."}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const ReadOnly = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AnaliseNova;
