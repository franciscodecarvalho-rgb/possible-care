import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileText, History, Settings, LogOut, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    supabase.auth.getSession().then(({ data: { session: initial } }) => setSession(initial));
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="border-b bg-navy">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-light">
            <FileText className="h-5 w-5 text-navy-foreground" />
          </div>
          <span className="text-lg font-semibold text-navy-foreground">
            Analisador de Crédito - POSSIBLE
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname === "/" || location.pathname.startsWith("/analise")
                ? "bg-navy-light text-navy-foreground"
                : "text-navy-foreground/70 hover:bg-navy-light/50 hover:text-navy-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Nova Análise
          </Link>
          <Link
            to="/clientes"
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname.startsWith("/clientes")
                ? "bg-navy-light text-navy-foreground"
                : "text-navy-foreground/70 hover:bg-navy-light/50 hover:text-navy-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Clientes
          </Link>
          <Link
            to="/historico"
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname === "/historico"
                ? "bg-navy-light text-navy-foreground"
                : "text-navy-foreground/70 hover:bg-navy-light/50 hover:text-navy-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            Histórico
          </Link>
          <Link
            to="/configuracoes"
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              location.pathname === "/configuracoes"
                ? "bg-navy-light text-navy-foreground"
                : "text-navy-foreground/70 hover:bg-navy-light/50 hover:text-navy-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          {session?.user?.email && (
            <div className="ml-3 flex items-center gap-2 border-l border-navy-foreground/20 pl-3">
              <span className="hidden text-xs text-navy-foreground/70 sm:inline">
                {session.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-foreground/70 transition-colors hover:bg-navy-light/50 hover:text-navy-foreground"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
