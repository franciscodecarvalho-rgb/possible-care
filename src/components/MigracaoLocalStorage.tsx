import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  loadLocalHistory,
  clearLocalHistory,
  saveHistoryResult,
  getExistingProtocolos,
  MIGRATION_DONE_KEY,
} from "@/lib/historyService";

type Props = {
  onMigrated: () => void;
};

const MigracaoLocalStorage = ({ onMigrated }: Props) => {
  const [localCount, setLocalCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const items = loadLocalHistory();
    setLocalCount(items.length);
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    const items = loadLocalHistory();
    try {
      const existing = await getExistingProtocolos(items.map(i => i.protocolo));
      const toMigrate = items.filter(i => !existing.has(i.protocolo));
      setProgress({ done: 0, total: toMigrate.length });
      let saved = 0;
      let skipped = items.length - toMigrate.length;
      for (let i = 0; i < toMigrate.length; i++) {
        try {
          await saveHistoryResult(toMigrate[i]);
          saved++;
        } catch (e) {
          console.error("Falha ao migrar", toMigrate[i].protocolo, e);
        }
        setProgress({ done: i + 1, total: toMigrate.length });
      }
      localStorage.setItem(MIGRATION_DONE_KEY, "true");
      setMigrated(true);
      toast.success(
        skipped > 0
          ? `${saved} análise(s) migrada(s). ${skipped} já existia(m) no banco.`
          : `${saved} análise(s) migrada(s) com sucesso.`
      );
      onMigrated();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na migração.");
    } finally {
      setMigrating(false);
      setProgress(null);
    }
  };

  const handleKeepLocal = () => {
    setDismissed(true);
  };

  const handleClearBackup = () => {
    clearLocalHistory();
    setLocalCount(0);
    setDismissed(true);
    toast.success("Backup local removido.");
  };

  if (dismissed || localCount === 0) return null;

  if (migrated) {
    return (
      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">Migração concluída.</p>
            <p className="mt-1 text-xs text-green-800">
              Os dados antigos ainda estão no navegador como backup.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleClearBackup}>
                Limpar backup local
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                Manter por garantia
              </Button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-green-700 hover:text-green-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            📦 Encontramos {localCount} análise(s) salva(s) localmente no navegador.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Deseja migrar para o banco? Análises com protocolo já existente serão ignoradas.
          </p>
          {progress && (
            <p className="mt-2 text-xs font-medium text-amber-900">
              Migrando {progress.done} de {progress.total}...
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleMigrate} disabled={migrating}>
              {migrating ? "Migrando..." : "Migrar agora"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleKeepLocal} disabled={migrating}>
              Manter local por enquanto
            </Button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-700 hover:text-amber-900">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MigracaoLocalStorage;
