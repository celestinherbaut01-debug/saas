"use client";

import { useState } from "react";
import type { Recipe, RecipeIngredient, InventoryItem } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { recipeCost, foodCostPercent, formatEUR } from "@/lib/restaurant";

export function RecipesModule({
  rows,
  ingredients,
  inventory,
  onCreate,
  onUpdate,
  onRemove,
  onAddIngredient,
  onRemoveIngredient,
}: {
  rows: Recipe[];
  ingredients: RecipeIngredient[];
  inventory: InventoryItem[];
  onCreate: (input: { name: string; sellingPrice: string }) => void;
  onUpdate: (id: string, patch: Partial<Recipe>) => void;
  onRemove: (id: string) => void;
  onAddIngredient: (recipeId: string, input: { inventoryItemId: string; itemName: string; quantity: number; unitCost: number }) => void;
  onRemoveIngredient: (ingredient: RecipeIngredient) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  function ingredientsOf(recipeId: string) {
    return ingredients.filter((i) => i.recipe_id === recipeId);
  }

  const detailRecipe = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  function submit() {
    if (!name.trim()) return;
    onCreate({ name, sellingPrice });
    setName("");
    setSellingPrice("");
    setCreateOpen(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Recettes & Food cost</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter une recette
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🍳" title="Aucune recette" description="Ajoutez une recette et ses ingrédients pour calculer le food cost réel." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter une recette</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Recette</Th>
                  <Th className="text-right">Coût matière</Th>
                  <Th className="text-right">Prix de vente</Th>
                  <Th className="text-right">Food cost</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((r) => {
                  const cost = recipeCost(ingredientsOf(r.id));
                  const pct = foodCostPercent(cost, r.selling_price);
                  const high = pct != null && pct > 33;
                  return (
                    <Tr key={r.id} onClick={() => setDetailId(r.id)}>
                      <Td className="font-semibold text-ink">{r.name}</Td>
                      <Td className="text-right text-muted">{formatEUR(cost)}</Td>
                      <Td className="text-right font-semibold">{formatEUR(r.selling_price)}</Td>
                      <Td className="text-right">
                        {pct != null ? (
                          <span className={cn("font-semibold", high && "text-red-fg")}>
                            {pct.toFixed(0)}% {high && <Badge tone="danger" className="ml-1">Élevé</Badge>}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <p className="mt-2 text-[10.5px] text-faint">Repère courant en restauration : food cost {"<"} 30-33% du prix de vente.</p>
        </div>
      )}

      {createOpen && (
        <Drawer open onClose={() => setCreateOpen(false)} title="Ajouter une recette">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              Nom de la recette
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              Prix de vente (€)
              <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
            </label>
          </div>
          <div className="mt-5">
            <Button className="w-full" onClick={submit} disabled={!name.trim()}>
              Créer — ajoutez les ingrédients ensuite
            </Button>
          </div>
        </Drawer>
      )}

      {detailRecipe && (
        <RecipeDetail
          recipe={detailRecipe}
          ingredients={ingredientsOf(detailRecipe.id)}
          inventory={inventory}
          onClose={() => setDetailId(null)}
          onPatch={(patch) => onUpdate(detailRecipe.id, patch)}
          onAddIngredient={(input) => onAddIngredient(detailRecipe.id, input)}
          onRemoveIngredient={onRemoveIngredient}
          onRemove={() => { onRemove(detailRecipe.id); setDetailId(null); }}
        />
      )}
    </Card>
  );
}

function RecipeDetail({
  recipe,
  ingredients,
  inventory,
  onClose,
  onPatch,
  onAddIngredient,
  onRemoveIngredient,
  onRemove,
}: {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  inventory: InventoryItem[];
  onClose: () => void;
  onPatch: (patch: Partial<Recipe>) => void;
  onAddIngredient: (input: { inventoryItemId: string; itemName: string; quantity: number; unitCost: number }) => void;
  onRemoveIngredient: (ingredient: RecipeIngredient) => void;
  onRemove: () => void;
}) {
  const [sellingPrice, setSellingPrice] = useState(String(recipe.selling_price));
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const cost = recipeCost(ingredients);
  const pct = foodCostPercent(cost, recipe.selling_price);

  function submit() {
    const item = inventory.find((i) => i.id === selectedItemId);
    if (!item) return;
    onAddIngredient({ inventoryItemId: item.id, itemName: item.name, quantity: Number(quantity) || 1, unitCost: item.unit_cost });
    setSelectedItemId("");
    setQuantity("1");
  }

  return (
    <Drawer open onClose={onClose} title={recipe.name}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Prix de vente (€)
          <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} onBlur={() => onPatch({ selling_price: Number(sellingPrice) || 0 })} />
        </label>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Ingrédients</p>
          {ingredients.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {ingredients.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                  <span>
                    {i.item_name} <span className="text-faint">× {i.quantity}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{formatEUR(i.unit_cost * i.quantity)}</span>
                    <button onClick={() => onRemoveIngredient(i)} className="text-[11px] text-faint hover:text-red-fg">
                      Retirer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-1.5">
            <Select className="h-9 flex-1" value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
              <option value="">Choisir un ingrédient…</option>
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatEUR(i.unit_cost)} / {i.unit})
                </option>
              ))}
            </Select>
            <Input type="number" min="1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 w-16" />
            <Button size="sm" onClick={submit} disabled={!selectedItemId}>
              Ajouter
            </Button>
          </div>
        </div>

        <div className="rounded-lg bg-soft px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-muted">Coût matière</span>
            <span className="font-display text-[14px] font-bold">{formatEUR(cost)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-muted">Food cost</span>
            <span className="font-display text-[14px] font-bold">{pct != null ? `${pct.toFixed(0)}%` : "—"}</span>
          </div>
        </div>

        <button type="button" onClick={onRemove} className="self-start text-[11.5px] font-semibold text-faint hover:text-red-fg">
          Supprimer cette recette
        </button>
      </div>
    </Drawer>
  );
}
