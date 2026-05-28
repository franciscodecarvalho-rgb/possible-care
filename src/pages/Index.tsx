import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listarClientes, maskDocumento, type Cliente } from "@/lib/clienteService";

const Index = () => {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const termo = busca.trim();
  const habilitado = termo.length >= 2;

  useEffect(() => {
    if (!habilitado) {
      setResultados([]);
      setAberto(false);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listarClientes({ busca: termo });
        setResultados(data.slice(0, 8));
        setAberto(true);
      } catch (err: any) {
        toast.error(err?.message || "Erro ao buscar clientes.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [termo, habilitado]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const placeholder = useMemo(
    () => (habilitado ? "Buscando…" : "Digite ao menos 2 letras do nome ou documento"),
    [habilitado],
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Nova análise de crédito</h1>
          <p className="mt-2 text-muted-foreground">Selecione um cliente para iniciar uma análise.</p>
        </div>

        <div className="mx-auto mt-10 max-w-xl space-y-4" ref={boxRef}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onFocus={() => habilitado && setAberto(true)}
              placeholder={placeholder}
              className="pl-10"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}

            {aberto && habilitado && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
                {resultados.length === 0 && !loading && (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                )}
                <ul className="max-h-72 overflow-y-auto">
                  {resultados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => navigate(`/analise/nova?cliente=${c.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{c.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {maskDocumento(c.documento, c.tipo as "pf" | "pj")} · {c.tipo.toUpperCase()}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate("/clientes")}>
              <Users className="mr-2 h-4 w-4" /> Ver todos os clientes
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
