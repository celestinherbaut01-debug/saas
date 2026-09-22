import { createHash } from "node:crypto";

// ANTI-RÉPÉTITION (point 3 de la refonte) — un fingerprint stable identifie
// "la même recommandation" pour ne jamais la présenter deux fois comme
// neuve tant que rien n'a réellement changé. Composé de : workspace + type
// d'objectif + source du signal (voir fingerprintSeed sur ScenarioResult,
// déjà bucketé — voir scenarios.ts) + une période. La période est une
// semaine ISO plutôt qu'un horodatage exact : sans borne temporelle, une
// recommandation identique resterait "déjà vue" indéfiniment même après
// plusieurs mois — ce n'est pas le comportement voulu (voir la conversation
// produit : on veut éviter le bruit à court terme, pas figer l'analyse).

/** Semaine ISO (ex. "2026-W38") — fenêtre de péremption naturelle du fingerprint. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function computeFingerprint(workspaceId: string, goalType: string, fingerprintSeed: string, at: Date = new Date()): string {
  const raw = `${workspaceId}|${goalType}|${fingerprintSeed}|${isoWeekKey(at)}`;
  return createHash("sha256").update(raw).digest("hex");
}
