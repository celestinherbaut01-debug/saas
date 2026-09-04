import type { PurchaseOrder, RecipeIngredient } from "@/lib/supabase/types";
import type { BadgeTone } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";

export { formatEUR };

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrder["status"], { text: string; tone: BadgeTone }> = {
  draft: { text: "Brouillon", tone: "neutral" },
  ordered: { text: "Commandé", tone: "accent" },
  received: { text: "Reçu", tone: "success" },
  canceled: { text: "Annulé", tone: "neutral" },
};

/** Coût matière d'une recette = somme des coûts de ses ingrédients (jamais un chiffre inventé). */
export function recipeCost(ingredients: RecipeIngredient[]): number {
  return ingredients.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
}

/** % du prix de vente absorbé par le coût matière — ratio standard en restauration. */
export function foodCostPercent(cost: number, sellingPrice: number): number | null {
  if (sellingPrice <= 0) return null;
  return (cost / sellingPrice) * 100;
}

export interface RestaurantAlert {
  level: "danger" | "warning";
  text: string;
}

export function computeRestaurantAlerts(
  { purchaseOrders }: { purchaseOrders: PurchaseOrder[] },
  advanced: boolean,
): RestaurantAlert[] {
  const alerts: RestaurantAlert[] = [];
  if (!advanced) return alerts;
  for (const po of purchaseOrders) {
    if (po.status === "ordered" && po.ordered_at) {
      const daysSince = (Date.now() - new Date(po.ordered_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince > 7) alerts.push({ level: "warning", text: `Commande fournisseur en attente depuis plus de 7 jours` });
    }
  }
  return alerts;
}
