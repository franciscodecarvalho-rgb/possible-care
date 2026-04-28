import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const APP_PASSWORD = "Possible";

const Login = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      sessionStorage.setItem("app_authenticated", "true");
      setError(false);
      navigate("/");
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy">
            <FileText className="h-6 w-6 text-navy-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Analisador de Crédito</h1>
          <p className="text-sm text-muted-foreground">Sistema interno de análise de crédito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Digite a senha de acesso"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            autoFocus
          />
          {error && <p className="text-sm font-medium text-destructive">Senha incorreta</p>}
          <Button type="submit" className="w-full bg-navy text-navy-foreground hover:bg-navy-light">
            <LogIn className="mr-2 h-4 w-4" />
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
