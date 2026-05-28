// Persistence layer for scoring_config — backed by Supabase.
// Keeps localStorage in sync so the synchronous loadConfig() used by
// creditScoring.ts and the analysis pages always sees fresh data.

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CONFIG,
  type ScoringConfig,
  loadConfig as loadConfigLocal,
  saveConfig as saveConfigLocal,
} from "./scoringConfig";

const LEGACY_STORAGE_KEY = "scoring_config";
const MIGRATION_FLAG = "config_migration_done";

/**
 * Fetch the singleton scoring config from the database.
 * Falls back to in-memory DEFAULT_CONFIG when the row does not exist yet.
 * Also writes the result to localStorage so sync consumers stay fresh.
 */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const { data, error } = await supabase
    .from("scoring_config")
    .select("config")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[scoringConfigService] load error:", error);
    throw new Error("Não foi possível carregar as configurações.");
  }

  if (!data) {
    return structuredClone(DEFAULT_CONFIG);
  }

  const config = data.config as unknown as ScoringConfig;
  // Hydrate the sync cache used by creditScoring.ts / Analise pages.
  try {
    saveConfigLocal(config);
  } catch {
    /* ignore */
  }
  return config;
}

/**
 * Upsert the singleton config row. Throws a friendly error when RLS
 * blocks the write (non-admin users).
 */
export async function saveScoringConfig(config: ScoringConfig): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const { error } = await supabase
    .from("scoring_config")
    .upsert(
      { id: 1, config: config as any, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );

  if (error) {
    const msg = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
    if (
      msg.includes("row-level security") ||
      msg.includes("policy") ||
      error.code === "42501" ||
      error.code === "PGRST301"
    ) {
      throw new Error("Apenas administradores podem alterar configurações.");
    }
    console.error("[scoringConfigService] save error:", error);
    throw new Error(error.message || "Erro ao salvar configurações.");
  }

  // Keep the sync cache in sync.
  try {
    saveConfigLocal(config);
  } catch {
    /* ignore */
  }
}

/**
 * One-time silent migration: if there is a localStorage config and the DB
 * row does not exist yet, upsert it. Marks a flag to avoid re-running.
 * Errors are swallowed (e.g. user is not admin) — migration is best-effort.
 */
export async function migrateLocalConfigIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG) === "true") return;

  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  try {
    const { data } = await supabase
      .from("scoring_config")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      // DB already has a row — nothing to migrate.
      localStorage.setItem(MIGRATION_FLAG, "true");
      return;
    }

    const local = loadConfigLocal();
    await saveScoringConfig(local);
    localStorage.setItem(MIGRATION_FLAG, "true");
  } catch (err) {
    // Best-effort; don't mark as done so a future admin login can retry.
    console.warn("[scoringConfigService] silent migration skipped:", err);
  }
}
