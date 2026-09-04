"use client";

import type { InventoryItem, WasteLogEntry, PurchaseOrder, Recipe, RecipeIngredient } from "@/lib/supabase/types";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { recipeCost, foodCostPercent, type RestaurantAlert } from "@/lib/restaurant";

export function RestaurantDashboard({
  inventory,
  wasteLog,
  purchaseOrders,
  recipes,
  recipeIngredients,
  alerts,
}: {
  inventory: InventoryItem[];
  wasteLog: WasteLogEntry[];
  purchaseOrders: PurchaseOrder[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  alerts: RestaurantAlert[];
}) {
  const weekAgo = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
  const lowStock = inventory.filter((i) => i.low_stock_threshold != null && i.quantity <= i.low_stock_threshold);
  const wasteThisWeek = wasteLog.filter((w) => new Date(w.logged_at).getTime() >= weekAgo).reduce((s, w) => s + (w.estimated_cost ?? 0), 0);
  const pendingOrders = purchaseOrders.filter((po) => po.status === "draft" || po.status === "ordered").length;

  const pcts = recipes
    .map((r) => foodCostPercent(recipeCost(recipeIngredients.filter((i) => i.recipe_id === r.id)), r.selling_price))
    .filter((p): p is number => p != null);
  const avgFoodCost = pcts.length > 0 ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Ingrédients en stock critique" value={String(lowStock.length)} />
        <StatTile label="Pertes cette semaine" value={`${wasteThisWeek.toFixed(0)} €`} />
        <StatTile label="Commandes en attente" value={String(pendingOrders)} />
        <StatTile label="Food cost moyen" value={avgFoodCost != null ? `${avgFoodCost.toFixed(0)}%` : "—"} sub={recipes.length > 0 ? `${recipes.length} recette(s)` : "Aucune recette"} />
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-bg bg-amber-bg/40">
          <h2 className="text-[13px] font-bold text-ink">Alertes</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
            {alerts.slice(0, 6).map((a, i) => (
              <li key={i} className="text-amber-fg">
                {a.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
