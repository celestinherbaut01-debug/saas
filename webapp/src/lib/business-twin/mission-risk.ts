// AJUSTEMENT (partiel V1) — évalue si une mission avance assez vite pour
// tenir son échéance, et signale les actions bloquées depuis trop longtemps.
// Toujours dérivé du rythme RÉEL (actions faites / total, temps écoulé),
// jamais une prédiction chiffrée ("vous avez 80% de chances d'y arriver").

export interface MissionRiskInput {
  deadline: string | null;
  totalActions: number;
  doneActions: number;
}

export type MissionRiskStatus = "on_track" | "at_risk" | "no_deadline";

export interface MissionRiskAssessment {
  status: MissionRiskStatus;
  /** Note façon NOVA — toujours qualitative, jamais un pourcentage de réussite inventé. */
  note: string | null;
}

export function assessMissionRisk(input: MissionRiskInput): MissionRiskAssessment {
  if (!input.deadline || input.totalActions === 0) return { status: "no_deadline", note: null };

  const daysLeft = (new Date(input.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  const completionRate = input.doneActions / input.totalActions;

  if (daysLeft < 0 && completionRate < 1) {
    return { status: "at_risk", note: "L'échéance est dépassée et toutes les actions ne sont pas terminées." };
  }
  if (daysLeft <= 7 && completionRate < 0.5) {
    return { status: "at_risk", note: "À ce rythme, la mission nécessite davantage d'actions commerciales avant l'échéance." };
  }
  return { status: "on_track", note: null };
}

export interface BlockerInput {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

/** Une action encore "proposée" depuis trop longtemps est un blocage réel — pas une supposition. */
export function computeBlockers(actions: BlockerInput[], staleDays = 5): string[] {
  const now = Date.now();
  return actions
    .filter((a) => a.status === "proposed" && now - new Date(a.created_at).getTime() > staleDays * 24 * 60 * 60 * 1000)
    .map((a) => `"${a.title}" est toujours en attente depuis plus de ${staleDays} jours.`);
}
