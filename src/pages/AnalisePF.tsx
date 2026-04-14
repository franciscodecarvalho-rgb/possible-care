import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import { extractFromFiles } from "@/lib/extractionService";
import { IRPF_PROMPT, COMPROVANTE_PROMPT } from "@/lib/pdfExtractor";

const AnalisePF = () => {
  const navigate = useNavigate();
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [uploadOption, setUploadOption] = useState<"irpf" | "comprovantes">("irpf");
  const [irpfFiles, setIrpfFiles] = useState<File[]>([]);
  const [comprovanteFiles, setComprovanteFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    const v = parseFloat(valor.replace(/\D/g, ""));
    if (!valor || isNaN(v) || v <= 0) e.valor = "Informe um valor maior que zero.";
    if (!prazo || parseInt(prazo) <= 0) e.prazo = "Informe um prazo válido.";
    if (uploadOption === "irpf" && irpfFiles.length === 0)
      e.irpf = "Envie a declaração IRPF.";
    if (uploadOption === "comprovantes" && comprovanteFiles.length === 0)
      e.comprovantes = "Envie pelo menos 1 comprovante de rendimento.";
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
      const files = uploadOption === "irpf" ? irpfFiles : comprovanteFiles;
      const prompt = uploadOption === "irpf" ? IRPF_PROMPT : COMPROVANTE_PROMPT;

      const extracted = await extractFromFiles(files, prompt, setProgressMsg);

      navigate("/preview", {
        state: {
          extractedData: extracted,
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
            <Label>Documentos de comprovação</Label>
            <RadioGroup
              value={uploadOption}
              onValueChange={(v) => setUploadOption(v as "irpf" | "comprovantes")}
              className="flex gap-6"
              disabled={loading}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="irpf" id="opt-irpf" />
                <Label htmlFor="opt-irpf" className="cursor-pointer font-normal">
                  Declaração IRPF completa
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="comprovantes" id="opt-comp" />
                <Label htmlFor="opt-comp" className="cursor-pointer font-normal">
                  Comprovantes de rendimento
                </Label>
              </div>
            </RadioGroup>

            {uploadOption === "irpf" ? (
              <FileDropzone
                label="Upload da Declaração IRPF (1 PDF)"
                maxFiles={1}
                files={irpfFiles}
                onFilesChange={setIrpfFiles}
                error={errors.irpf}
              />
            ) : (
              <FileDropzone
                label="Upload dos comprovantes de rendimento (até 3 PDFs)"
                maxFiles={3}
                files={comprovanteFiles}
                onFilesChange={setComprovanteFiles}
                error={errors.comprovantes}
              />
            )}
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
    </div>
  );
};

export default AnalisePF;
