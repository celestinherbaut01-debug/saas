// Business Analytics — uniquement des fonctions pures sur de vraies données
// déjà chargées (aucun accès Supabase ici, testable par exécution réelle).
// Jamais un chiffre de CA/ROI/conversion futur inventé : tout se déduit du
// statut ACTUEL des prospects, jamais d'une reconstitution d'historique
// qu'on n'a pas (voir caption honnête affichée à côté du funnel).

import type { ProspectStatus } from "@/lib/crm-status";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  pctOfFirst: number | null;
}

const CONTACTED_OR_LATER: ProspectStatus[] = ["contacted", "replied", "interested", "rdv", "quote", "won", "lost"];
const RDV_OR_LATER: ProspectStatus[] = ["rdv", "quote", "won"];

export function computeFunnel(statuses: { status: string }[]): FunnelStage[] {
  const total = statuses.length;
  const contacted = statuses.filter((s) => CONTACTED_OR_LATER.includes(s.status as ProspectStatus)).length;
  const rdv = statuses.filter((s) => RDV_OR_LATER.includes(s.status as ProspectStatus)).length;
  const won = statuses.filter((s) => s.status === "won").length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : null);
  return [
    { key: "prospects", label: "Prospects trouvés", count: total, pctOfFirst: pct(total) },
    { key: "contacted", label: "Contactés", count: contacted, pctOfFirst: pct(contacted) },
    { key: "rdv", label: "RDV obtenus", count: rdv, pctOfFirst: pct(rdv) },
    { key: "won", label: "Clients gagnés", count: won, pctOfFirst: pct(won) },
  ];
}

export interface WeekPoint {
  weekStart: string;
  label: string;
  count: number;
}

function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/** Nombre de nouveaux prospects par semaine (dernières `weeks` semaines, semaine courante incluse). */
export function computeWeeklyNewProspects(createdAts: string[], weeks: number, now: Date = new Date()): WeekPoint[] {
  const currentWeekStart = isoWeekStart(now);
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);
    points.push({
      weekStart: weekStart.toISOString(),
      label: weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }
  for (const iso of createdAts) {
    const ws = isoWeekStart(new Date(iso)).toISOString();
    const point = points.find((p) => p.weekStart === ws);
    if (point) point.count += 1;
  }
  return points;
}
