import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import FileDropzone from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

const finalidades = [
  "Capital de giro",
  "Aquisição de equipamento",
  "Imóvel",
  "Veículo",
  "Outros",
];

const AnalisePJ = () => {
  const navigate = useNavigate();
  const [nomeRep, setNomeRep] = useState("");
  const [cpfRep, setCpfRep] = useState("");
  const [valor, setValor] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [prazo, setPrazo] = useState("");
  const [balancosFiles, setBalancosFiles] = useState<File[]>([]);
  const [faturamentoFiles, setFaturamentoFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!nomeRep.trim()) e.nomeRep = "Informe o nome do representante.";
    if (!cpfRep.trim() || cpfRep.replace(/\D/g, "").length !== 11)
      e.cpfRep = "Informe um CPF válido (11 dígitos).";
    const v = parseFloat(valor);
    if (!valor || isNaN(v) || v <= 0) e.valor = "Informe um valor maior que zero.";
    if (!finalidade) e.finalidade = "Selecione uma finalidade.";
    if (!prazo || parseInt(prazo) <= 0) e.prazo = "Informe um prazo válido.";
    if (balancosFiles.length === 0)
      e.balancos = "Envie os 3 últimos balanços patrimoniais.";
    if (faturamentoFiles.length === 0)
      e.faturamento = "Envie o relatório de faturamento.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    toast.success("Análise enviada com sucesso!");
    navigate("/resultado");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground">Análise — Pessoa Jurídica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados e envie os documentos necessários
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nomeRep">Nome do representante legal</Label>
              <Input
                id="nomeRep"
                value={nomeRep}
                onChange={(e) => setNomeRep(e.target.value)}
                placeholder="Nome completo"
                className={errors.nomeRep ? "border-destructive" : ""}
              />
              {errors.nomeRep && <p className="text-xs text-destructive">{errors.nomeRep}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpfRep">CPF do representante</Label>
              <Input
                id="cpfRep"
                value={cpfRep}
                onChange={(e) => setCpfRep(e.target.value)}
                placeholder="000.000.000-00"
                className={errors.cpfRep ? "border-destructive" : ""}
              />
              {errors.cpfRep && <p className="text-xs text-destructive">{errors.cpfRep}</p>}
            </div>
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
            />
            {errors.valor && <p className="text-xs text-destructive">{errors.valor}</p>}
          </div>

          <div className="space-y-2">
            <Label>Finalidade do crédito</Label>
            <Select value={finalidade} onValueChange={setFinalidade}>
              <SelectTrigger className={errors.finalidade ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione a finalidade" />
              </SelectTrigger>
              <SelectContent>
                {finalidades.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.finalidade && <p className="text-xs text-destructive">{errors.finalidade}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prazo">Prazo desejado (meses)</Label>
            <Input
              id="prazo"
              type="number"
              min="1"
              placeholder="Ex: 36"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className={errors.prazo ? "border-destructive" : ""}
            />
            {errors.prazo && <p className="text-xs text-destructive">{errors.prazo}</p>}
          </div>

          <div className="space-y-5">
            <FileDropzone
              label="3 últimos Balanços Patrimoniais (até 3 PDFs)"
              maxFiles={3}
              files={balancosFiles}
              onFilesChange={setBalancosFiles}
              error={errors.balancos}
            />

            <FileDropzone
              label="Relatório de Faturamento dos últimos 12 meses (1 PDF)"
              maxFiles={1}
              files={faturamentoFiles}
              onFilesChange={setFaturamentoFiles}
              error={errors.faturamento}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              Todos os documentos devem estar assinados pela administração e pelo contador com
              registro ativo no CRC.
            </p>
          </div>

          <Button type="submit" className="w-full bg-navy text-navy-foreground hover:bg-navy-light" size="lg">
            Analisar Crédito
          </Button>
        </form>
      </main>
    </div>
  );
};

export default AnalisePJ;
