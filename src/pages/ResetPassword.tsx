import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase já processa o token de recovery do hash e dispara PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Caso o evento já tenha sido disparado antes do listener montar
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      toast.success("Senha redefinida com sucesso");
      await supabase.auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy">
            <FileText className="h-6 w-6 text-navy-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Redefinir senha</h1>
          <p className="text-center text-sm text-muted-foreground">
            {ready
              ? "Escolha uma nova senha para acessar o sistema"
              : "Validando link de recuperação..."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            required
            autoFocus
            autoComplete="new-password"
            disabled={!ready}
          />
          <Input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(null); }}
            required
            autoComplete="new-password"
            disabled={!ready}
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !ready}
            className="w-full bg-navy text-navy-foreground hover:bg-navy-light"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Voltar ao login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
