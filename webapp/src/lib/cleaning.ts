import type { Intervention, Incident, Contract } from "@/lib/supabase/types";
import type { BadgeTone } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";

export { formatEUR };

export const INTERVENTION_STATUS_LABEL: Record<Intervention["status"], { text: string; tone: BadgeTone }> = {
  planned: { text: "Planifiée", tone: "accent" },
  done: { text: "Réalisée", tone: "success" },
  missed: { text: "Manquée", tone: "danger" },
};

export const INCIDENT_SEVERITY_LABEL: Record<Incident["severity"], { text: string; tone: BadgeTone }> = {
  low: { text: "Mineur", tone: "neutral" },
  medium: { text: "Moyen", tone: "warning" },
  high: { text: "Grave", tone: "danger" },
};

export const CONTRACT_STATUS_LABEL: Record<Contract["status"], { text: string; tone: BadgeTone }> = {
  active: { text: "Actif", tone: "success" },
  ending_soon: { text: "À renouveler", tone: "warning" },
  ended: { text: "Terminé", tone: "neutral" },
};

export interface CleaningAlert {
  level: "danger" | "warning";
  text: string;
}

/** Alertes calculées en direct — jamais stockées. Voir lib/garage.ts pour le même principe. */
export function computeCleaningAlerts(
  { contracts, interventions, incidents }: { contracts: Contract[]; interventions: Intervention[]; incidents: Incident[] },
  advanced: boolean,
): CleaningAlert[] {
  const alerts: CleaningAlert[] = [];
  const now = new Date().getTime();

  for (const c of contracts) {
    if (c.status === "ending_soon") alerts.push({ level: "warning", text: `Contrat ${c.site_name} à renouveler${c.renewal_date ? ` (le ${new Date(c.renewal_date).toLocaleDateString("fr-FR")})` : ""}` });
  }
  for (const it of interventions) {
    if (it.status === "planned" && new Date(it.scheduled_at).getTime() < now) {
      alerts.push({ level: "danger", text: `Intervention non réalisée, prévue le ${new Date(it.scheduled_at).toLocaleDateString("fr-FR")}` });
    }
  }
  for (const inc of incidents) {
    if (inc.status === "open" && inc.severity === "high") alerts.push({ level: "danger", text: `Incident grave ouvert : ${inc.title}` });
  }

  if (advanced) {
    for (const inc of incidents) {
      if (inc.status === "open" && inc.severity !== "high") alerts.push({ level: "warning", text: `Incident ouvert : ${inc.title}` });
    }
  }

  return alerts;
}
