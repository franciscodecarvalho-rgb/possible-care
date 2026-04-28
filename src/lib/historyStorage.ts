import type { ScoringResult } from "./creditScoring";

export const HISTORY_STORAGE_KEY = "credit_history";
const MAX_HISTORY_ITEMS = 100;

const isValidHistoryItem = (item: unknown): item is ScoringResult => {
  if (!item || typeof item !== "object") return false;
  const r = item as Partial<ScoringResult>;
  return Boolean(r.protocolo && r.data && r.tipo && typeof r.score === "number" && Array.isArray(r.breakdown));
};

export const loadHistory = (): ScoringResult[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isValidHistoryItem)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    return [];
  }
};

export const persistHistory = (history: ScoringResult[]) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
    throw error;
  }
};

export const saveHistoryResult = (result: ScoringResult) => {
  const history = loadHistory();
  const existing = history.find((item) =>
    item.analysisKey ? item.analysisKey === result.analysisKey : item.protocolo === result.protocolo
  );

  if (existing) {
    persistHistory(history.map((item) =>
      item.protocolo === existing.protocolo ? { ...result, protocolo: existing.protocolo, data: existing.data } : item
    ));
    return;
  }

  persistHistory([result, ...history]);
};