import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        if (
          signInError.message.toLowerCase().includes("invalid") ||
          signInError.message.toLowerCase().includes("credentials")
        ) {
          setError("Email ou senha incorretos");
        } else {
          setError("Não foi possível entrar. Tente novamente.");
          toast.error(signInError.message);
        }
        setPassword("");
        return;
      }
      navigate("/");
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Informe seu email para receber o link de redefinição");
      return;
    }
    setResetting(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setInfo("Se o email existir, você receberá instruções para redefinir a senha.");
    } catch (err) {
      console.error(err);
      setInfo("Se o email existir, você receberá instruções para redefinir a senha.");
    } finally {
      setResetting(false);
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
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); setInfo(null); }}
            required
            autoFocus
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {info && <p className="text-sm font-medium text-foreground">{info}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-navy-foreground hover:bg-navy-light"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetting}
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
          >
            {resetting ? "Enviando..." : "Esqueci minha senha"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
