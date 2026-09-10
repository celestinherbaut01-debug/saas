import type { ProspectStatus } from "@/lib/crm-status";

// NOVA Growth Autopilot — détection d'opportunités 100% déterministe, sans
// IA générative. Généralise le pattern déjà en place dans
// lib/automation-insights.ts et lib/garage.ts (computeGarageAlerts) : des
// fonctions pures, calculées en direct depuis les vraies données déjà
// chargées par l'appelant, jamais stockées ni inventées.
//
// Règle produit non négociable : aucune performance, aucun ROI, aucun taux
// de conversion inventé. Un score "high/medium/low" est toujours dérivé
// d'une règle explicable (voir `reason` sur chaque opportunité) — jamais un
// pourcentage de confiance fabriqué ("94% de chances de convertir").
//
// Ce que ce fichier NE fait PAS (volontairement, voir l'analyse produit) :
// - "créneaux vides" au sens strict (nécessiterait une notion de capacité/
//   horaires d'ouverture qui n'existe pas dans le schéma) — remplacé par une
//   comparaison relative honnête (compareToTrailingAverage).
// - upsell : aucune règle déterministe défendable sans données d'usage
//   réelles pour la valider — délibérément absent plutôt qu'inventé.

export type OpportunityPriority = "high" | "medium" | "low";

export interface Opportunity {
  /** Stable pour un même type de signal — sert de clé à nova_action_log (marquer fait/ignorer). */
  key: string;
  icon: string;
  title: string;
  /** Pourquoi cette opportunité est remontée — toujours dérivé de vraies données, jamais une affirmation vague. */
  reason: string;
  /** Qualitatif UNIQUEMENT — jamais un chiffre de CA/ROI/conversion inventé. */
  impact: string;
  priority: OpportunityPriority;
  source: string;
  actionLabel: string;
  actionHref: string;
  /** Si true, peut être marqué "fait"/"ignoré" (voir nova_action_log) — sinon recalculé en direct à chaque fois, sans statut. */
  dismissible: boolean;
}

function daysBetween(a: number, b: number): number {
  return Math.floor(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

/** Même mécanisme que lib/automation-insights.ts : ouvre NOVA avec une question pré-remplie, jamais un faux bouton "Envoyer". */
export function askNovaHref(prompt: string): string {
  return `/agent?prompt=${encodeURIComponent(prompt)}`;
}

interface DocumentLike {
  id: string;
  doc_type: "quote" | "invoice";
  status: string;
  issued_at: string;
  due_at: string | null;
  number: string;
  customer_id: string | null;
}

/**
 * Devis envoyés sans réponse depuis plusieurs jours. Généralise l'alerte qui
 * existait déjà uniquement dans computeGarageAlerts (5 jours fixe, Garage
 * seulement) à toutes les verticales, avec une priorité qui dépend
 * réellement de l'ancienneté (voir item 11 : 7 jours -> high, 2 jours ->
 * pas encore remonté du tout, en dessous du seuil minimal).
 */
export function detectUnansweredQuotes(documents: DocumentLike[]): Opportunity | null {
  const now = Date.now();
  const flagged = documents
    .filter((d) => d.doc_type === "quote" && d.status === "sent")
    .map((d) => ({ ...d, days: daysBetween(now, new Date(d.issued_at).getTime()) }))
    .filter((d) => d.days >= 3);

  if (flagged.length === 0) return null;
  const maxDays = Math.max(...flagged.map((d) => d.days));

  return {
    key: "unanswered_quotes",
    icon: "💰",
    title: `${flagged.length} devis sans réponse depuis plus de 3 jours`,
    reason: `Le plus ancien a été envoyé il y a ${maxDays} jour(s) sans réponse du client.`,
    impact: "Un devis non relancé a plus de chances d'être oublié ou accepté ailleurs.",
    priority: maxDays >= 7 ? "high" : "medium",
    source: "Devis & factures",
    actionLabel: "Préparer les relances",
    actionHref: askNovaHref(
      "Liste-moi les devis envoyés depuis plus de 3 jours sans réponse, avec le nom du client et le montant, pour que je les relance.",
    ),
    dismissible: true,
  };
}

/** Factures dont la date d'échéance est dépassée sans statut "payée"/"annulée". */
export function detectOverdueInvoices(documents: DocumentLike[]): Opportunity | null {
  const now = Date.now();
  const overdue = documents
    .filter((d) => d.doc_type === "invoice" && d.status !== "paid" && d.status !== "canceled" && d.due_at)
    .map((d) => ({ ...d, daysLate: daysBetween(now, new Date(d.due_at as string).getTime()) }))
    .filter((d) => new Date(d.due_at as string).getTime() < now);

  if (overdue.length === 0) return null;
  const maxDaysLate = Math.max(...overdue.map((d) => d.daysLate));

  return {
    key: "overdue_invoices",
    icon: "⚠️",
    title: `${overdue.length} facture(s) en retard de paiement`,
    reason: `La plus ancienne est en retard de ${maxDaysLate} jour(s) par rapport à son échéance.`,
    impact: "Une facture en retard non relancée risque de rester impayée plus longtemps.",
    priority: maxDaysLate >= 30 ? "high" : maxDaysLate >= 10 ? "medium" : "low",
    source: "Devis & factures",
    actionLabel: "Préparer les relances",
    actionHref: askNovaHref(
      "Liste-moi les factures en retard de paiement, avec le nom du client et le montant, pour préparer une relance.",
    ),
    dismissible: true,
  };
}

interface StockLike {
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number | null;
}

/** Généralise l'alerte stock bas déjà présente (Garage/Nettoyage/Restaurant) — même règle, calculée une seule fois ici. */
export function detectLowStock(items: StockLike[]): Opportunity | null {
  const low = items.filter((i) => i.low_stock_threshold != null && i.quantity <= i.low_stock_threshold);
  if (low.length === 0) return null;

  return {
    key: "low_stock",
    icon: "📦",
    title: `${low.length} référence(s) en stock bas`,
    reason: low
      .slice(0, 3)
      .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
      .join(", ") + (low.length > 3 ? "…" : ""),
    impact: "Un réapprovisionnement à temps évite une rupture qui bloquerait une intervention.",
    priority: low.length >= 5 ? "high" : "medium",
    source: "Stock",
    actionLabel: "Voir le stock",
    actionHref: "/business-os",
    dismissible: false,
  };
}

/** Renouvellements (contrats, domaines, hébergements...) dans une fenêtre proche — généralise buildRenewalInsight avec le détail par entité. */
export function detectRenewalsUpcoming(renewals: { label: string; date: string }[], withinDays = 30): Opportunity | null {
  const now = Date.now();
  const soon = renewals.filter((r) => {
    const days = (new Date(r.date).getTime() - now) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= withinDays;
  });
  if (soon.length === 0) return null;

  return {
    key: "renewals_upcoming",
    icon: "📅",
    title: `${soon.length} renouvellement(s) à prévoir dans les ${withinDays} jours`,
    reason: soon
      .slice(0, 3)
      .map((r) => r.label)
      .join(", ") + (soon.length > 3 ? "…" : ""),
    impact: "Anticiper un renouvellement évite une interruption de service pour le client.",
    priority: "medium",
    source: "Contrats & sites",
    actionLabel: "Voir le détail",
    actionHref: askNovaHref("Quels renouvellements (contrats, domaines, hébergements) arrivent bientôt ?"),
    dismissible: false,
  };
}

/**
 * Clients sans devis/facture depuis longtemps. Approximation assumée : il
 * n'existe aucune date "dernier contact" par client dans le schéma — on
 * dérive donc l'activité de la dernière date de devis/facture, pas d'un
 * historique de contact complet. Un client jamais facturé (last=null) n'est
 * PAS compté "inactif" — on ne sait juste rien de lui, on ne l'affirme pas.
 */
export function detectInactiveCustomers(
  customers: { id: string }[],
  documents: { customer_id: string | null; issued_at: string }[],
  inactiveDays = 180,
): Opportunity | null {
  const now = Date.now();
  const lastDocByCustomer = new Map<string, number>();
  for (const d of documents) {
    if (!d.customer_id) continue;
    const t = new Date(d.issued_at).getTime();
    const cur = lastDocByCustomer.get(d.customer_id);
    if (cur == null || t > cur) lastDocByCustomer.set(d.customer_id, t);
  }

  const inactive = customers.filter((c) => {
    const last = lastDocByCustomer.get(c.id);
    return last != null && now - last > inactiveDays * 24 * 60 * 60 * 1000;
  });
  if (inactive.length === 0) return null;

  const months = Math.round(inactiveDays / 30);
  return {
    key: "inactive_customers",
    icon: "👤",
    title: `${inactive.length} client(s) sans devis ni facture depuis plus de ${months} mois`,
    reason: "Basé sur la date du dernier devis/de la dernière facture — pas un historique de contact complet.",
    impact: "Une réactivation peut relancer un client qui vous avait déjà fait confiance.",
    priority: "medium",
    source: "Clients",
    actionLabel: "Créer une campagne de réactivation",
    actionHref: askNovaHref(
      `Liste-moi les clients sans devis ni facture depuis plus de ${months} mois, avec leurs coordonnées.`,
    ),
    dismissible: true,
  };
}

/** Prospects avec un bon score, pas encore contactés — donnée déjà réelle (quality_score persisté), juste jamais mise en avant comme opportunité. */
export function detectPriorityProspects(
  prospects: { quality_score: number; status: ProspectStatus }[],
  threshold = 70,
): Opportunity | null {
  const NOT_YET_CONTACTED: ProspectStatus[] = ["new", "to_contact"];
  const priority = prospects.filter((p) => p.quality_score >= threshold && NOT_YET_CONTACTED.includes(p.status));
  if (priority.length === 0) return null;

  return {
    key: "priority_prospects",
    icon: "🎯",
    title: `${priority.length} prospect(s) très pertinent(s) pas encore contacté(s)`,
    reason: `Score d'opportunité ≥ ${threshold}/100, statut encore "Nouveau" ou "À contacter".`,
    impact: "Un score élevé signale un profil qui correspond le mieux à votre offre.",
    priority: priority.length >= 10 ? "high" : priority.length >= 3 ? "medium" : "low",
    source: "Prospects (CRM)",
    actionLabel: "Voir les prospects",
    actionHref: "/crm",
    dismissible: false,
  };
}

export type TrendSignal =
  | { status: "insufficient_data" }
  | { status: "normal"; currentCount: number; averageCount: number }
  | { status: "below_average"; currentCount: number; averageCount: number; dropPercent: number };

/**
 * Comparaison relative honnête, sans notion de capacité inventée :
 * - direction "future" : combien d'événements tombent dans les 7 prochains
 *   jours, comparé à la moyenne des 4 semaines précédentes au même horizon
 *   (sert de proxy pour "sous-réservation", sans supposer une capacité).
 * - direction "past" : combien d'événements ont été CRÉÉS cette semaine,
 *   comparé à la moyenne des semaines précédentes (sert de proxy pour
 *   "baisse d'activité").
 *
 * Si l'historique est trop court pour être fiable (moins de la moitié des
 * fenêtres passées ont au moins un événement, ou volume total très bas),
 * renvoie "insufficient_data" plutôt qu'un chiffre — jamais une conclusion
 * tirée de trop peu de données.
 */
export function compareToTrailingAverage(
  allDates: string[],
  opts: { windowDays: number; trailingWindows: number; direction: "future" | "past" },
): TrendSignal {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const windowMs = opts.windowDays * DAY;
  const timestamps = allDates.map((d) => new Date(d).getTime());

  const countInRange = (start: number, end: number) => timestamps.filter((t) => t >= start && t < end).length;

  let currentCount: number;
  const trailingCounts: number[] = [];

  if (opts.direction === "future") {
    currentCount = countInRange(now, now + windowMs);
    for (let w = 1; w <= opts.trailingWindows; w++) {
      trailingCounts.push(countInRange(now - w * windowMs, now - (w - 1) * windowMs));
    }
  } else {
    currentCount = countInRange(now - windowMs, now);
    for (let w = 1; w <= opts.trailingWindows; w++) {
      trailingCounts.push(countInRange(now - (w + 1) * windowMs, now - w * windowMs));
    }
  }

  const totalHistory = trailingCounts.reduce((a, b) => a + b, 0);
  const nonEmptyWindows = trailingCounts.filter((c) => c > 0).length;
  if (nonEmptyWindows < Math.ceil(opts.trailingWindows / 2) || totalHistory < 3) {
    return { status: "insufficient_data" };
  }

  const averageCount = Math.round((totalHistory / opts.trailingWindows) * 10) / 10;
  if (averageCount > 0 && currentCount <= averageCount * 0.5) {
    return { status: "below_average", currentCount, averageCount, dropPercent: Math.round((1 - currentCount / averageCount) * 100) };
  }
  return { status: "normal", currentCount, averageCount };
}

/** "Sous-réservation" — remplace l'idée fabriquée de "créneaux vides" par une comparaison relative réelle et explicable. */
export function detectUnderbooking(scheduledDates: string[], label: string): Opportunity | null {
  const signal = compareToTrailingAverage(scheduledDates, { windowDays: 7, trailingWindows: 4, direction: "future" });
  if (signal.status !== "below_average") return null;

  return {
    key: `underbooking:${label}`,
    icon: "📉",
    title: `${label} : ${signal.currentCount} prévu(s) la semaine prochaine (moyenne habituelle : ${signal.averageCount})`,
    reason: `${signal.dropPercent}% de moins que la moyenne des 4 dernières semaines à ce même horizon.`,
    impact: "Une semaine sous-remplie est un bon moment pour lancer une campagne locale.",
    priority: signal.dropPercent >= 70 ? "high" : "medium",
    source: label,
    actionLabel: "Préparer une campagne",
    actionHref: `/nova/actions?campaign=${encodeURIComponent(label)}`,
    dismissible: true,
  };
}

/** Baisse d'activité générale (nouveaux ordres/documents créés) — même garde-fou "pas assez d'historique". */
export function detectActivityDecline(createdDates: string[], label: string): Opportunity | null {
  const signal = compareToTrailingAverage(createdDates, { windowDays: 7, trailingWindows: 4, direction: "past" });
  if (signal.status !== "below_average") return null;

  return {
    key: `activity_decline:${label}`,
    icon: "📉",
    title: `${label} : activité en baisse cette semaine (${signal.currentCount} vs ${signal.averageCount} en moyenne)`,
    reason: `${signal.dropPercent}% de moins que la moyenne des 4 dernières semaines.`,
    impact: "Une baisse d'activité détectée tôt laisse plus de temps pour réagir.",
    priority: signal.dropPercent >= 70 ? "high" : "medium",
    source: label,
    actionLabel: "Voir des idées de campagne",
    actionHref: `/nova/actions?campaign=${encodeURIComponent(label)}`,
    dismissible: true,
  };
}

/** Trie par priorité (high en premier) — l'ordre au sein d'une même priorité n'est pas garanti. */
export function sortByPriority(opportunities: Opportunity[]): Opportunity[] {
  const rank: Record<OpportunityPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...opportunities].sort((a, b) => rank[a.priority] - rank[b.priority]);
}

export interface ActionLogEntry {
  status: "done" | "dismissed";
  updatedAt: string;
}

/**
 * Masque une opportunité "dismissible" pendant `snoozeHours` après avoir été
 * marquée fait/ignorée. `key` est un identifiant AGRÉGÉ ("unanswered_quotes"),
 * pas par entité — un vrai "supprimer pour toujours" n'aurait pas de sens
 * ici : un NOUVEAU devis en retard doit pouvoir refaire remonter le signal
 * après la fenêtre de snooze, plutôt que de rester invisible indéfiniment.
 */
export function filterSnoozed(opportunities: Opportunity[], log: Map<string, ActionLogEntry>, snoozeHours = 24): Opportunity[] {
  const now = Date.now();
  return opportunities.filter((o) => {
    if (!o.dismissible) return true;
    const entry = log.get(o.key);
    if (!entry) return true;
    const hoursSince = (now - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60);
    return hoursSince >= snoozeHours;
  });
}

const FIXED_KEY_LABELS: Record<string, string> = {
  unanswered_quotes: "Devis sans réponse",
  overdue_invoices: "Factures en retard",
  low_stock: "Stock bas",
  renewals_upcoming: "Renouvellements à prévoir",
  inactive_customers: "Clients inactifs",
  priority_prospects: "Prospects prioritaires",
};

/**
 * Libellé humain pour une clé d'opportunité — utilisé par l'Historique
 * (nova_action_log), qui ne stocke QUE la clé (voir 0030_nova_action_log.sql)
 * et doit donc pouvoir la retraduire sans revenir chercher les données
 * d'origine. Gère aussi les clés composées ("underbooking:<label>",
 * "activity_decline:<label>") produites par sortByPriority ci-dessus.
 */
export function opportunityKeyLabel(key: string): string {
  if (key in FIXED_KEY_LABELS) return FIXED_KEY_LABELS[key];
  const separatorIndex = key.indexOf(":");
  if (separatorIndex === -1) return key;
  const prefix = key.slice(0, separatorIndex);
  const suffix = key.slice(separatorIndex + 1);
  if (prefix === "underbooking") return `Sous-réservation — ${suffix}`;
  if (prefix === "activity_decline") return `Baisse d'activité — ${suffix}`;
  return key;
}
