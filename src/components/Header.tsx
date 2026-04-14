import { Link, useLocation } from "react-router-dom";
import { FileText, History } from "lucide-react";

const Header = () => {
  const location = useLocation();

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
        </nav>
      </div>
    </header>
  );
};

export default Header;
