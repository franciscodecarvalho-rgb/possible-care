import { useLocation, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface SectionProps {
  title: string;
  data: Record<string, any>;
}

const formatValue = (val: any): string => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (typeof val === "number") {
    if (Number.isInteger(val) && val > 1000) return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (!Number.isInteger(val)) return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return val.toString();
  }
  return String(val);
};

const formatLabel = (key: string): string =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const DataSection = ({ title, data }: SectionProps) => {
  const simpleEntries = Object.entries(data).filter(
    ([, v]) => !Array.isArray(v) && typeof v !== "object"
  );
  const arrayEntries = Object.entries(data).filter(([, v]) => Array.isArray(v));

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
      {simpleEntries.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {simpleEntries.map(([key, val]) => (
            <div key={key} className="flex justify-between border-b border-border/50 py-1.5">
              <dt className="text-sm text-muted-foreground">{formatLabel(key)}</dt>
              <dd className="text-sm font-medium text-foreground">{formatValue(val)}</dd>
            </div>
          ))}
        </dl>
      )}
      {arrayEntries.map(([key, arr]) => (
        <div key={key} className="mt-4">
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">{formatLabel(key)}</h4>
          <div className="space-y-2">
            {(arr as any[]).slice(0, 10).map((item, i) => (
              <div key={i} className="rounded border bg-muted/30 p-3 text-sm">
                {typeof item === "object" ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(item).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted-foreground">{formatLabel(k)}</dt>
                        <dd className="font-medium">{formatValue(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <span>{formatValue(item)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const categorizeIRPF = (data: Record<string, any>) => {
  const sections: { title: string; data: Record<string, any> }[] = [];

  const ident: Record<string, any> = {};
  const rend: Record<string, any> = {};
  const pat: Record<string, any> = {};
  const imp: Record<string, any> = {};

  const identKeys = ["nome_completo", "cpf", "data_nascimento", "ocupacao"];
  const rendKeys = [
    "rendimentos_tributaveis_pj", "fontes_pagadoras", "rendimentos_isentos_total",
    "dividendos_recebidos", "empresas_dividendos", "rendimentos_tributacao_exclusiva",
    "renda_total_anual", "numero_fontes_renda", "multiplas_fontes",
  ];
  const patKeys = [
    "bens_direitos_total_atual", "bens_direitos_total_anterior", "bens_lista",
    "possui_imovel", "possui_veiculo", "dividas_onus_total_atual",
  ];
  const impKeys = [
    "total_deducoes", "contribuicao_previdenciaria", "despesas_medicas",
    "imposto_retido_fonte", "imposto_devido_total", "imposto_a_pagar",
    "imposto_a_restituir", "aliquota_efetiva_percentual",
  ];

  for (const [k, v] of Object.entries(data)) {
    if (identKeys.includes(k)) ident[k] = v;
    else if (rendKeys.includes(k)) rend[k] = v;
    else if (patKeys.includes(k)) pat[k] = v;
    else if (impKeys.includes(k)) imp[k] = v;
    else rend[k] = v;
  }

  if (Object.keys(ident).length) sections.push({ title: "Identificação", data: ident });
  if (Object.keys(rend).length) sections.push({ title: "Rendimentos", data: rend });
  if (Object.keys(pat).length) sections.push({ title: "Patrimônio", data: pat });
  if (Object.keys(imp).length) sections.push({ title: "Impostos e Deduções", data: imp });
  return sections;
};

const Preview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const extractedData = location.state?.extractedData as Record<string, any> | undefined;
  const tipo = (location.state?.tipo as string) || "pf";
  const formData = location.state?.formData as { valor: number; prazo: number; finalidade: string } | undefined;

  if (!extractedData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
          <p className="text-muted-foreground">Nenhum dado para exibir.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </main>
      </div>
    );
  }

  const sections =
    tipo === "pf"
      ? categorizeIRPF(extractedData)
      : [{ title: "Dados Extraídos", data: extractedData }];

  const handleConfirm = () => {
    toast.success("Relatório será gerado em breve.");
    navigate("/resultado", { state: { extractedData, tipo, formData } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Preview dos Dados Extraídos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Confira os dados antes de gerar o relatório
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>

        <div className="mt-8 space-y-6">
          {sections.map((sec) => (
            <DataSection key={sec.title} title={sec.title} data={sec.data} />
          ))}
        </div>

        <Button
          onClick={handleConfirm}
          className="mt-8 w-full bg-navy text-navy-foreground hover:bg-navy-light"
          size="lg"
        >
          <CheckCircle className="mr-2 h-5 w-5" />
          Confirmar e Gerar Relatório
        </Button>
      </main>
    </div>
  );
};

export default Preview;
