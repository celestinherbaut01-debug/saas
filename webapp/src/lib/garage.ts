import type { RepairOrder, BusinessDocument, RepairOrderPart, Part, TeamMember } from "@/lib/supabase/types";
import type { BadgeTone } from "@/components/ui/badge";

// Workflow réel d'un garage — seule référence pour l'ordre des statuts et
// leur libellé, utilisée par le Kanban (Atelier), le tableau (Ordres de
// réparation), le Planning et l'Historique pour ne jamais diverger.
export const REPAIR_STATUS_ORDER: RepairOrder["status"][] = [
  "diagnostic",
  "quote",
  "accepted",
  "in_progress",
  "waiting_parts",
  "done",
  "delivered",
];

export const REPAIR_STATUS_LABEL: Record<RepairOrder["status"], { text: string; tone: BadgeTone }> = {
  diagnostic: { text: "À diagnostiquer", tone: "neutral" },
  quote: { text: "Devis", tone: "accent" },
  accepted: { text: "Accepté", tone: "accent" },
  in_progress: { text: "En réparation", tone: "warning" },
  waiting_parts: { text: "En attente pièce", tone: "danger" },
  done: { text: "Terminé", tone: "success" },
  delivered: { text: "Livré", tone: "dark" },
};

export const REPAIR_STATUS_ACTIVE: RepairOrder["status"][] = [
  "diagnostic",
  "quote",
  "accepted",
  "in_progress",
  "waiting_parts",
];

export const DOC_TYPE_LABEL: Record<BusinessDocument["doc_type"], string> = {
  quote: "Devis",
  invoice: "Facture",
};

export const DOC_STATUS_LABEL: Record<BusinessDocument["status"], { text: string; tone: BadgeTone }> = {
  draft: { text: "Brouillon", tone: "neutral" },
  sent: { text: "Envoyé", tone: "accent" },
  accepted: { text: "Accepté", tone: "success" },
  refused: { text: "Refusé", tone: "danger" },
  paid: { text: "Payée", tone: "success" },
  overdue: { text: "En retard", tone: "danger" },
  canceled: { text: "Annulé", tone: "neutral" },
};

export function repairOrderTotalPrice(labor_cost: number, partsPrice: number): number {
  return labor_cost + partsPrice;
}

/** Somme des lignes de pièces d'un ordre — coût (achat) et prix (vente), jamais confondus. */
export function partsTotals(lines: RepairOrderPart[]): { cost: number; price: number } {
  return lines.reduce(
    (acc, l) => ({ cost: acc.cost + l.unit_cost * l.quantity, price: acc.price + l.unit_price * l.quantity }),
    { cost: 0, price: 0 },
  );
}

export interface GarageAlert {
  level: "danger" | "warning";
  text: string;
  orderId?: string;
}

/**
 * Alertes calculées en direct depuis les vraies données — jamais une valeur
 * stockée ou inventée. `advanced` (plan Max) ajoute des signaux
 * supplémentaires (devis en attente, charge technicien) au-delà du socle
 * simple (stock bas + retards) disponible au plan Pro.
 */
export function computeGarageAlerts(
  { parts, repairOrders, documents, technicians }: { parts: Part[]; repairOrders: RepairOrder[]; documents: BusinessDocument[]; technicians: TeamMember[] },
  advanced: boolean,
): GarageAlert[] {
  const alerts: GarageAlert[] = [];
  const now = Date.now();

  for (const p of parts) {
    if (p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold) {
      alerts.push({ level: "danger", text: `${p.name} — stock bas (${p.quantity} ${p.unit} restant(s), seuil ${p.low_stock_threshold})` });
    }
  }

  for (const r of repairOrders) {
    if (r.scheduled_at && new Date(r.scheduled_at).getTime() < now && r.status !== "done" && r.status !== "delivered") {
      alerts.push({ level: "warning", text: `${r.title} — en retard (prévu le ${new Date(r.scheduled_at).toLocaleDateString("fr-FR")})`, orderId: r.id });
    }
  }

  if (advanced) {
    const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;
    for (const d of documents) {
      if (d.doc_type === "quote" && d.status === "sent" && new Date(d.issued_at).getTime() < fiveDaysAgo) {
        alerts.push({ level: "warning", text: `Devis ${d.number || d.id.slice(0, 8)} envoyé depuis plus de 5 jours sans réponse` });
      }
    }
    const activeByTechnician = new Map<string, number>();
    for (const r of repairOrders) {
      if (r.technician_id && REPAIR_STATUS_ACTIVE.includes(r.status)) {
        activeByTechnician.set(r.technician_id, (activeByTechnician.get(r.technician_id) ?? 0) + 1);
      }
    }
    for (const [techId, count] of activeByTechnician) {
      if (count > 5) {
        const tech = technicians.find((t) => t.id === techId);
        alerts.push({ level: "warning", text: `${tech?.name ?? "Technicien"} a ${count} ordres actifs en parallèle` });
      }
    }
  }

  return alerts;
}

export function formatEUR(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
