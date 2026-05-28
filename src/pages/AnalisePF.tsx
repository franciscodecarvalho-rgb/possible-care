import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { extractFromFiles } from "@/lib/extractionService";
import { IRPF_PROMPT } from "@/lib/pdfExtractor";
import { loadConfig } from "@/lib/scoringConfig";

const AnalisePF = () => {
  const navigate = useNavigate();
  const defaultPrazo = String(loadConfig().financialParams.prazoPadrao || 24);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState(defaultPrazo);
  const [irpfFiles, setIrpfFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    const v = parseFloat(valor.replace(/\D/g, ""));
    if (!nome.trim()) e.nome = "Informe o nome completo.";
    if (!documento.trim()) e.documento = "Informe o CPF.";
    if (!valor || isNaN(v) || v <= 0) e.valor = "Informe um valor maior que zero.";
    if (!prazo || parseInt(prazo) <= 0) e.prazo = "Informe um prazo válido.";
    if (irpfFiles.length === 0) e.irpf = "Envie a declaração IRPF.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Corrija os campos destacados.");
      return;
    }

    setLoading(true);
    try {
      const extracted = await extractFromFiles(irpfFiles, IRPF_PROMPT, setProgressMsg);
      const identifiedData = {
        ...extracted,
        nome_completo: nome.trim(),
        cpf: documento.trim(),
      };

      navigate("/preview", {
        state: {
          extractedData: identifiedData,
          tipo: "pf",
          formData: { valor: parseFloat(valor), prazo: parseInt(prazo), finalidade: "" },
        },
      });
    } catch (err: any) {
      console.error("AnalisePF erro completo:", err);
      toast.error(err?.message || "Erro desconhecido no processamento.");
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-6 py-10">
        <BackButton to="/" />
        <h1 className="text-2xl font-bold text-foreground">Análise — Pessoa Física</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados e envie os documentos necessários
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo / Razão Social</Label>
            <Input
              id="nome"
              type="text"
              placeholder="Nome completo do cliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={errors.nome ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="documento">CPF / CNPJ</Label>
            <Input
              id="documento"
              type="text"
              placeholder="CPF do cliente"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className={errors.documento ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.documento && <p className="text-xs text-destructive">{errors.documento}</p>}
          </div>

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
              "Analisar Crédito"
            )}
          </Button>
        </form>
      </main>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Processando análise</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              {[
                "📄 Lendo documento...",
                "🤖 Extraindo dados...",
                "📊 Calculando score...",
                "✅ Gerando relatório...",
              ].map((step, index) => (
                <div key={step} className={`rounded-md border px-3 py-2 ${progressMsg || index === 0 ? "bg-muted/50 text-foreground" : "opacity-70"}`}>
                  {step}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{progressMsg || "Iniciando processamento..."}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisePF;
