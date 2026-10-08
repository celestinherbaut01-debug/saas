import type { InventoryItem, InventoryMovement, SupplierOrder } from "@/lib/supabase/types";
import type { BadgeTone } from "@/components/ui/badge";

export const MOVEMENT_TYPE_LABEL: Record<InventoryMovement["type"], { text: string; tone: BadgeTone }> = {
  reception: { text: "Réception", tone: "success" },
  sale: { text: "Vente", tone: "neutral" },
  loss: { text: "Perte", tone: "danger" },
  adjustment: { text: "Ajustement", tone: "accent" },
};

export const ORDER_STATUS_LABEL: Record<SupplierOrder["status"], { text: string; tone: BadgeTone }> = {
  draft: { text: "Brouillon", tone: "neutral" },
  sent: { text: "Envoyée", tone: "accent" },
  confirmed: { text: "Confirmée", tone: "accent" },
  received: { text: "Reçue", tone: "success" },
  canceled: { text: "Annulée", tone: "neutral" },
};

export { formatEUR } from "@/lib/format";

export interface ButcherAlert {
  level: "danger" | "warning";
  text: string;
  itemId?: string;
}

/**
 * Alertes calculées en direct depuis les vraies données — jamais une
 * traçabilité réglementaire certifiée : on signale honnêtement les lots
 * dont la DLC a été RÉELLEMENT saisie à la réception et approche, sans
 * prétendre suivre la quantité restante par lot (ce que ce schéma ne fait
 * pas). C'est une alerte de surveillance, pas un contrôle de conformité.
 */
export function computeButcherAlerts(
  { items, movements, orders }: { items: InventoryItem[]; movements: InventoryMovement[]; orders: SupplierOrder[] },
): ButcherAlert[] {
  const alerts: ButcherAlert[] = [];
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  for (const item of items) {
    if (item.archived_at) continue;
    if (item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold) {
      alerts.push({ level: "danger", text: `${item.name} — stock bas (${item.quantity} ${item.unit} restant(s), seuil ${item.low_stock_threshold})`, itemId: item.id });
    }
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const m of movements) {
    if (m.type !== "reception" || !m.expires_on) continue;
    const diff = new Date(m.expires_on).getTime() - now;
    if (diff >= 0 && diff <= sevenDays) {
      const item = itemById.get(m.item_id);
      const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
      alerts.push({
        level: days <= 2 ? "danger" : "warning",
        text: `${item?.name ?? "Produit"} — lot${m.lot_number ? ` ${m.lot_number}` : ""} à DLC le ${new Date(m.expires_on).toLocaleDateString("fr-FR")} (dans ${days} jour${days > 1 ? "s" : ""})`,
        itemId: m.item_id,
      });
    }
  }

  const pendingOrders = orders.filter((o) => o.status === "sent" || o.status === "confirmed");
  for (const o of pendingOrders) {
    if (o.expected_at && new Date(o.expected_at).getTime() < now) {
      alerts.push({ level: "warning", text: `Commande du ${new Date(o.ordered_at).toLocaleDateString("fr-FR")} attendue le ${new Date(o.expected_at).toLocaleDateString("fr-FR")} — pas encore marquée reçue` });
    }
  }

  return alerts;
}
