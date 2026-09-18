import type { BusinessOsVertical } from "@/lib/business-os";
import { compareToTrailingAverage } from "@/lib/nova-opportunities";
import { type DataField, realField, insufficientField } from "./types";

// SITUATION — construit le snapshot à partir de données DÉJÀ chargées par
// l'appelant (voir lib/business-os-data.ts) : ce module reste pur (aucun
// accès Supabase), comme lib/nova-opportunities.ts, pour rester testable
// par exécution réelle sans dépendance réseau.

export interface SnapshotInputs {
  vertical: BusinessOsVertical;
  /** null = module Acquisition non disponible sur ce plan/workspace (pas "0 prospect"). */
  prospects: { quality_score: number; status: string }[] | null;
  documents: {
    doc_type: "quote" | "invoice";
    status: string;
    issued_at: string;
    due_at: string | null;
    paid_at: string | null;
    total_ttc: number;
  }[];
  customers: { id: string }[];
  lowStockItems: { quantity: number; low_stock_threshold: number | null }[];
  /** Rendez-vous/ordres/interventions à venir, selon la verticale — sert à la comparaison de capacité. */
  scheduledDates: string[];
  renewalDates: { date: string }[];
}

const DAY = 24 * 60 * 60 * 1000;

export function buildSnapshotMetrics(inputs: SnapshotInputs): Record<string, DataField<unknown>> {
  const metrics: Record<string, DataField<unknown>> = {};
  const now = Date.now();

  // --- Chiffre d'affaires encaissé (30 derniers jours) ---
  if (inputs.documents.length === 0) {
    metrics.revenuePaidLast30d = insufficientField(
      "Aucun devis ni facture enregistré.",
      "Créez vos premiers devis/factures dans Business OS pour activer ce calcul.",
    );
  } else {
    const paid = inputs.documents.filter((d) => d.doc_type === "invoice" && d.status === "paid" && d.paid_at);
    const sum30d = paid.filter((d) => now - new Date(d.paid_at as string).getTime() <= 30 * DAY).reduce((s, d) => s + d.total_ttc, 0);
    metrics.revenuePaidLast30d = realField(sum30d, `${paid.length} facture(s) marquée(s) payée(s) dans l'historique.`);
  }

  // --- Prospects prioritaires (module Acquisition) ---
  if (inputs.prospects === null) {
    metrics.priorityProspectsCount = insufficientField("Module Acquisition non activé sur ce workspace.", "Activez la prospection pour détecter des prospects prioritaires.");
  } else if (inputs.prospects.length === 0) {
    metrics.priorityProspectsCount = insufficientField("Aucun prospect enregistré.", "Lancez une recherche de prospects depuis Prospection.");
  } else {
    const NOT_CONTACTED = new Set(["new", "to_contact"]);
    const priority = inputs.prospects.filter((p) => p.quality_score >= 70 && NOT_CONTACTED.has(p.status));
    metrics.priorityProspectsCount = realField(priority.length, `${inputs.prospects.length} prospect(s) au total, score de pertinence ≥ 70 et pas encore contactés.`);
  }

  // --- Clients ---
  metrics.customersCount = realField(inputs.customers.length, "Table clients du Business OS.");

  // --- Devis/factures ---
  const unanswered = inputs.documents.filter((d) => d.doc_type === "quote" && d.status === "sent");
  metrics.unansweredQuotesCount = realField(unanswered.length, "Devis avec statut \"envoyé\".");

  const overdue = inputs.documents.filter(
    (d) => d.doc_type === "invoice" && d.status !== "paid" && d.status !== "canceled" && d.due_at && new Date(d.due_at).getTime() < now,
  );
  metrics.overdueInvoicesCount = realField(overdue.length, "Factures dont l'échéance est dépassée.");
  metrics.overdueInvoicesAmount = realField(
    overdue.reduce((s, d) => s + d.total_ttc, 0),
    "Somme des montants TTC des factures en retard.",
  );

  // --- Stock ---
  if (inputs.lowStockItems.length === 0) {
    metrics.lowStockCount = insufficientField("Aucun article de stock renseigné.", "Ajoutez vos articles/pièces dans Business OS pour suivre le stock bas.");
  } else {
    const low = inputs.lowStockItems.filter((i) => i.low_stock_threshold != null && i.quantity <= i.low_stock_threshold);
    metrics.lowStockCount = realField(low.length, `${inputs.lowStockItems.length} référence(s) suivie(s), seuil d'alerte défini.`);
  }

  // --- Capacité / planning à venir (comparaison honnête, jamais de notion de "capacité" inventée) ---
  const capacitySignal = compareToTrailingAverage(inputs.scheduledDates, { windowDays: 7, trailingWindows: 4, direction: "future" });
  if (capacitySignal.status === "insufficient_data") {
    metrics.capacityNextWeek = insufficientField(
      "Pas assez d'historique de planning pour comparer la semaine prochaine à une moyenne fiable.",
      "Continuez à renseigner vos rendez-vous/interventions/ordres pendant quelques semaines.",
    );
  } else {
    metrics.capacityNextWeek = realField(
      { current: capacitySignal.currentCount, average: capacitySignal.averageCount },
      "Comparaison au nombre moyen d'événements sur les 4 semaines précédentes, au même horizon.",
    );
  }

  // --- Renouvellements à venir ---
  if (inputs.renewalDates.length === 0) {
    metrics.renewalsUpcomingCount = insufficientField("Aucun contrat/site avec date de renouvellement renseignée.", "Renseignez les dates de renouvellement dans Business OS.");
  } else {
    const soon = inputs.renewalDates.filter((r) => {
      const days = (new Date(r.date).getTime() - now) / DAY;
      return days >= 0 && days <= 30;
    });
    metrics.renewalsUpcomingCount = realField(soon.length, `${inputs.renewalDates.length} renouvellement(s) suivi(s) au total.`);
  }

  return metrics;
}
