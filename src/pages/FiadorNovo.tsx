import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import FileDropzone from "@/components/FileDropzone";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractFromFiles } from "@/lib/extractionService";
import { IRPF_PROMPT, PJ_BALANCO_PROMPT, PJ_FATURAMENTO_PROMPT } from "@/lib/pdfExtractor";
import { scorePF, scorePJ } from "@/lib/creditScoring";
import { criarFiador } from "@/lib/fiadorService";
import { maskCPF, maskCNPJ, validarDocumento } from "@/lib/clienteService";

const FiadorNovo = () => {
  const navigate = useNavigate();
  const { analiseId } = useParams<{ analiseId: string }>();

  const [tipo, setTipo] = useState<"pf" | "pj">("pf");
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [uploadOption, setUploadOption] = useState<"balancos" | "faturamento">("balancos");
  const [irpfFiles, setIrpfFiles] = useState<File[]>([]);
  const [balancosFiles, setBalancosFiles] = useState<File[]>([]);
  const [faturamentoFiles, setFaturamentoFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  const aplicarMascara = (v: string) => (tipo === "pf" ? maskCPF(v) : maskCNPJ(v));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = tipo === "pf" ? "Informe o nome." : "Informe a razão social.";
    if (!documento.trim()) e.documento = tipo === "pf" ? "Informe o CPF." : "Informe o CNPJ.";
    else if (!validarDocumento(documento, tipo))
      e.documento = tipo === "pf" ? "CPF inválido." : "CNPJ inválido.";
    if (tipo === "pf" && irpfFiles.length === 0) e.irpf = "Envie a declaração IRPF.";
    if (tipo === "pj") {
      if (uploadOption === "balancos" && balancosFiles.length === 0)
        e.balancos = "Envie os balanços patrimoniais.";
      if (uploadOption === "faturamento" && faturamentoFiles.length === 0)
        e.faturamento = "Envie o relatório de faturamento.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!analiseId) {
      toast.error("Análise inválida.");
      return;
    }
    if (!validate()) {
      toast.error("Corrija os campos destacados.");
      return;
    }

    setLoading(true);
    try {
      let extracted: Record<string, any>;
      let pjDocType: "balancos" | "faturamento" | null = null;

      if (tipo === "pf") {
        const raw = await extractFromFiles(irpfFiles, IRPF_PROMPT, setProgressMsg);
        extracted = { ...raw, nome_completo: nome.trim(), cpf: documento.trim() };
      } else if (uploadOption === "balancos") {
        const raw = await extractFromFiles(balancosFiles, PJ_BALANCO_PROMPT, setProgressMsg);
        extracted = {
          balancos: raw,
          pjDocType: "balancos",
          razao_social: nome.trim(),
          nome_completo: nome.trim(),
          cnpj: documento.trim(),
        };
        pjDocType = "balancos";
      } else {
        const raw = await extractFromFiles(faturamentoFiles, PJ_FATURAMENTO_PROMPT, setProgressMsg);
        extracted = {
          faturamento: raw,
          pjDocType: "faturamento",
          razao_social: nome.trim(),
          nome_completo: nome.trim(),
          cnpj: documento.trim(),
        };
        pjDocType = "faturamento";
      }

      setProgressMsg("Calculando score do fiador...");
      const result =
        tipo === "pf" ? scorePF(extracted, 0, 1, "fiador") : scorePJ(extracted, 0, 1, "fiador");

      setProgressMsg("Salvando fiador...");
      await criarFiador({
        analise_id: analiseId,
        tipo,
        pj_doc_type: pjDocType,
        nome: nome.trim(),
        documento: documento.trim(),
        score: result.score,
        decision: result.decision,
        decision_color: result.decisionColor,
        insufficient_data: result.insufficientData,
        extracted_data: extracted,
        breakdown: result.breakdown,
      });

      toast.success("Fiador cadastrado.");
      navigate(-1);
    } catch (err: any) {
      console.error("FiadorNovo erro:", err);
      toast.error(err?.message || "Erro ao cadastrar fiador.");
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-6 py-10">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-2xl font-bold text-foreground">Cadastrar fiador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O score do fiador é informativo. A decisão final continua sendo do analista.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => {
                setTipo(v as "pf" | "pj");
                setDocumento("");
              }}
              className="flex gap-6"
              disabled={loading}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pf" id="tipo-pf" />
                <Label htmlFor="tipo-pf" className="cursor-pointer font-normal">
                  Pessoa Física
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pj" id="tipo-pj" />
                <Label htmlFor="tipo-pj" className="cursor-pointer font-normal">
                  Pessoa Jurídica
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">{tipo === "pf" ? "Nome completo" : "Razão social"}</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={errors.nome ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="documento">{tipo === "pf" ? "CPF" : "CNPJ"}</Label>
            <Input
              id="documento"
              value={documento}
              onChange={(e) => setDocumento(aplicarMascara(e.target.value))}
              className={errors.documento ? "border-destructive" : ""}
              disabled={loading}
            />
            {errors.documento && <p className="text-xs text-destructive">{errors.documento}</p>}
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
                  <RadioGroupItem value="balancos" id="fopt-balancos" />
                  <Label htmlFor="fopt-balancos" className="cursor-pointer font-normal">
                    Balanços Patrimoniais
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="faturamento" id="fopt-faturamento" />
                  <Label htmlFor="fopt-faturamento" className="cursor-pointer font-normal">
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
              "Extrair e calcular score do fiador"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default FiadorNovo;
