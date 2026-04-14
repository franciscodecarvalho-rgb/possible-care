import { useNavigate } from "react-router-dom";
import { User, Building2 } from "lucide-react";
import Header from "@/components/Header";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Nova Análise de Crédito
          </h1>
          <p className="mt-2 text-muted-foreground">
            Selecione o tipo de pessoa para iniciar a análise
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          <button
            onClick={() => navigate("/analise/pf")}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-border bg-card p-10 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">Pessoa Física</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                CPF • Declaração IRPF ou comprovantes de renda
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate("/analise/pj")}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-border bg-card p-10 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-card-foreground">Pessoa Jurídica</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                CNPJ • Balanços patrimoniais e faturamento
              </p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Index;
