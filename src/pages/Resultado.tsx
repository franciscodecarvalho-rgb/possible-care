import { useLocation, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, FileText, Home, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { scorePF, type ScoringResult } from "@/lib/creditScoring";

const Resultado = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  const extractedData = location.state?.extractedData as Record<string, any> | undefined;
  const tipo = (location.state?.tipo as string) || "pf";
  const formData = location.state?.formData as { valor: number; prazo: number; finalidade: string } | undefined;

  useEffect(() => {
    if (location.state?.fromHistory) {
      setResult(location.state.fromHistory as ScoringResult);
      return;
    }
    if (!extractedData || !formData) return;
    if (tipo === "pf") {
      const r = scorePF(extractedData, formData.valor, formData.prazo, formData.finalidade);
      setResult(r);
    }
  }, []);

  // Animate score counter
  useEffect(() => {
    if (!result) return;
    const target = result.score;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedScore(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [result]);

  if (!extractedData || !formData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Nenhum dado para exibir.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </main>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Resultado da Análise</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Protocolo: <span className="font-mono font-semibold">{result.protocolo}</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" /> Início
          </Button>
        </div>

        {/* Score Hero */}
        <Card className="mt-8 overflow-hidden">
          <div className="p-8 text-center" style={{ borderTop: `4px solid ${result.decisionColor}` }}>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Score de Crédito</p>
            <p className="mt-2 text-6xl font-bold" style={{ color: result.decisionColor }}>
              {animatedScore}
            </p>
            <p className="text-sm text-muted-foreground">de 1000 pontos</p>
            <Progress value={(result.score / 1000) * 100} className="mt-4 h-3" />
            <div
              className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: result.decisionColor }}
            >
              {result.decision}
            </div>
          </div>
        </Card>

        {/* Breakdown */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento da Pontuação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.breakdown.map((b) => (
              <div key={b.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{b.category}</span>
                  <span className="font-semibold text-foreground">
                    {b.points} <span className="text-muted-foreground font-normal">/ {b.maxPoints}</span>
                  </span>
                </div>
                <Progress value={(b.points / b.maxPoints) * 100} className="mt-1 h-2" />
                <p className="mt-0.5 text-xs text-muted-foreground">{b.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Form Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Dados da Solicitação</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
              <div className="flex flex-col border-b border-border/50 pb-2">
                <dt className="text-xs text-muted-foreground">Valor Solicitado</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {formData.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </dd>
              </div>
              <div className="flex flex-col border-b border-border/50 pb-2">
                <dt className="text-xs text-muted-foreground">Prazo</dt>
                <dd className="text-sm font-semibold text-foreground">{formData.prazo} meses</dd>
              </div>
              <div className="flex flex-col border-b border-border/50 pb-2">
                <dt className="text-xs text-muted-foreground">Finalidade</dt>
                <dd className="text-sm font-semibold text-foreground">{formData.finalidade}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="mt-8 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/historico")}>
            Ver Histórico
          </Button>
          <Button className="flex-1 bg-navy text-navy-foreground hover:bg-navy-light" onClick={() => navigate("/")}>
            Nova Análise
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Resultado;
