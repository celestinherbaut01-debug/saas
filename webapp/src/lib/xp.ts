import { createClient } from "@/lib/supabase/server";

export interface XpLevel {
  level: number;
  label: string;
  minXp: number;
}

// Progression pensée pour rester atteignable avec une activité commerciale
// réelle (pas un simple compteur de clics) : voir les triggers XP dans
// 0008_xp.sql pour ce qui rapporte de l'XP.
export const XP_LEVELS: XpLevel[] = [
  { level: 1, label: "Débutant", minXp: 0 },
  { level: 2, label: "Prospecteur", minXp: 100 },
  { level: 3, label: "Négociateur", minXp: 300 },
  { level: 4, label: "Closer", minXp: 700 },
  { level: 5, label: "Expert", minXp: 1500 },
  { level: 6, label: "Stratège", minXp: 3000 },
];

export function levelForXp(xp: number): XpLevel {
  let current = XP_LEVELS[0];
  for (const l of XP_LEVELS) {
    if (xp >= l.minXp) current = l;
  }
  return current;
}

export function nextLevel(xp: number): XpLevel | null {
  const currentIndex = XP_LEVELS.findIndex((l) => l.level === levelForXp(xp).level);
  return XP_LEVELS[currentIndex + 1] ?? null;
}

export interface XpEvent {
  action: string;
  xp_amount: number;
  created_at: string;
}

export interface XpSummary {
  totalXp: number;
  level: XpLevel;
  next: XpLevel | null;
  progressPct: number; // vers le niveau suivant, 100 si niveau max atteint
  recentEvents: XpEvent[];
}

const ACTION_LABEL: Record<string, string> = {
  onboarding_completed: "Profil configuré",
  prospect_added: "Prospect ajouté au CRM",
  status_contacted: "Premier contact établi",
  status_replied: "Réponse obtenue",
  status_won: "Client gagné",
  appointment_created: "Rendez-vous créé",
};

export function xpActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

export async function getXpSummary(workspaceId: string): Promise<XpSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("xp_events")
    .select("action, xp_amount, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const events = data ?? [];
  const totalXp = events.reduce((acc, e) => acc + e.xp_amount, 0);
  const level = levelForXp(totalXp);
  const next = nextLevel(totalXp);
  const progressPct = next ? Math.round(((totalXp - level.minXp) / (next.minXp - level.minXp)) * 100) : 100;

  return { totalXp, level, next, progressPct, recentEvents: events.slice(0, 6) };
}
