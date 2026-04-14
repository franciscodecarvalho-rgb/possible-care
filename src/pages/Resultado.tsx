import Header from "@/components/Header";
import { FileText } from "lucide-react";

const Resultado = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-foreground">Relatório será exibido aqui</h1>
      <p className="mt-2 text-muted-foreground">
        Os resultados da análise de crédito aparecerão nesta tela.
      </p>
    </main>
  </div>
);

export default Resultado;
