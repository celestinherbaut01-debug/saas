import type { DataField } from "./types";

// Traduit les clés techniques internes (lib/business-twin/snapshot.ts) en
// libellés métier — un utilisateur ne doit jamais voir un nom de variable
// comme "lowStockCount". Une seule source de vérité pour ce mapping,
// utilisée par la page détail de mission.

export const SNAPSHOT_METRIC_LABEL: Record<string, string> = {
  revenuePaidLast30d: "Chiffre d'affaires encaissé (30 derniers jours)",
  priorityProspectsCount: "Prospects prioritaires non contactés",
  customersCount: "Clients enregistrés",
  inactiveCustomersCount: "Clients inactifs (+ de 6 mois)",
  unansweredQuotesCount: "Devis sans réponse",
  overdueInvoicesCount: "Factures impayées",
  overdueInvoicesAmount: "Montant des factures impayées",
  lowStockCount: "Produits en stock faible",
  capacityNextWeek: "Charge prévue la semaine prochaine",
  renewalsUpcomingCount: "Renouvellements à venir (30 jours)",
};

const CURRENCY_KEYS = new Set(["revenuePaidLast30d", "overdueInvoicesAmount"]);

export function snapshotMetricLabel(key: string): string {
  return SNAPSHOT_METRIC_LABEL[key] ?? key;
}

/** `capacityNextWeek` porte un objet {current, average} — jamais un JSON.stringify brut affiché à l'utilisateur. */
export function formatSnapshotFieldValue(key: string, field: DataField<unknown>): string {
  if (field.status === "insufficient") return field.reason;
  const v = field.value;
  if (key === "capacityNextWeek" && typeof v === "object" && v !== null && "current" in v && "average" in v) {
    const { current, average } = v as { current: number; average: number };
    return `${current} événement${current > 1 ? "s" : ""} (moyenne : ${average})`;
  }
  if (CURRENCY_KEYS.has(key) && typeof v === "number") {
    return `${v.toLocaleString("fr-FR")} €`;
  }
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

export const PREPARED_CONTENT_LABEL: Record<string, string> = {
  headline: "Titre",
  offerPrompt: "Votre offre (à préciser)",
  targetDescription: "Cible visée",
  facebookText: "Texte Facebook",
  instagramText: "Texte Instagram",
  visualIdea: "Idée de visuel",
  smsText: "Texte SMS",
  emailText: "Texte Email",
};

export function preparedContentLabel(key: string): string {
  return PREPARED_CONTENT_LABEL[key] ?? key;
}
