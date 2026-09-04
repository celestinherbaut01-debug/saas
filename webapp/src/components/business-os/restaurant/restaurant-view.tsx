"use client";

import { useMemo, useState } from "react";
import type {
  Customer,
  InventoryItem,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  Recipe,
  RecipeIngredient,
  WasteLogEntry,
  Appointment,
  TeamMember,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { computeRestaurantAlerts } from "@/lib/restaurant";
import { CustomersModule } from "@/components/business-os/customers-module";
import { InventoryModule } from "@/components/business-os/inventory-module";
import { AppointmentsModule } from "@/components/business-os/appointments-module";
import { WasteLogModule } from "@/components/business-os/waste-log-module";
import { TeamModule } from "@/components/business-os/team-module";
import { SuppliersModule } from "@/components/business-os/garage/garage-suppliers";
import { PurchaseOrdersModule } from "@/components/business-os/restaurant/restaurant-purchase-orders";
import { RecipesModule } from "@/components/business-os/restaurant/restaurant-recipes";
import { RestaurantDashboard } from "@/components/business-os/restaurant/restaurant-dashboard";

type Tab = "dashboard" | "customers" | "inventory" | "suppliers" | "purchase_orders" | "waste" | "recipes" | "planning" | "team";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Clients" },
  { key: "inventory", label: "Stocks & Ingrédients" },
  { key: "suppliers", label: "Fournisseurs" },
  { key: "purchase_orders", label: "Commandes" },
  { key: "waste", label: "Pertes" },
  { key: "recipes", label: "Recettes & Food cost" },
  { key: "planning", label: "Planning" },
  { key: "team", label: "Équipe" },
];

export function RestaurantView({
  workspaceId,
  isAdvanced,
  initialCustomers,
  initialInventory,
  initialSuppliers,
  initialPurchaseOrders,
  initialPurchaseOrderItems,
  initialRecipes,
  initialRecipeIngredients,
  initialWasteLog,
  initialAppointments,
  initialTeamMembers,
}: {
  workspaceId: string;
  isAdvanced: boolean;
  initialCustomers: Customer[];
  initialInventory: InventoryItem[];
  initialSuppliers: Supplier[];
  initialPurchaseOrders: PurchaseOrder[];
  initialPurchaseOrderItems: PurchaseOrderItem[];
  initialRecipes: Recipe[];
  initialRecipeIngredients: RecipeIngredient[];
  initialWasteLog: WasteLogEntry[];
  initialAppointments: Appointment[];
  initialTeamMembers: TeamMember[];
}) {
  const supabase = createClient();
  const [active, setActive] = useState<Tab>("dashboard");

  const [customers, setCustomers] = useState(initialCustomers);
  const [inventory, setInventory] = useState(initialInventory);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [purchaseOrders, setPurchaseOrders] = useState(initialPurchaseOrders);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState(initialPurchaseOrderItems);
  const [recipes, setRecipes] = useState(initialRecipes);
  const [recipeIngredients, setRecipeIngredients] = useState(initialRecipeIngredients);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);

  const alerts = useMemo(() => computeRestaurantAlerts({ purchaseOrders }, isAdvanced), [purchaseOrders, isAdvanced]);

  async function createCustomer(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase.from("customers").insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() }).select("*").single();
    if (!error && data) setCustomers((prev) => [data, ...prev]);
  }
  async function updateCustomer(id: string, patch: Partial<Customer>) {
    const { error } = await supabase.from("customers").update(patch).eq("id", id);
    if (!error) setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function removeCustomer(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (!error) setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  async function createInventoryItem(input: { name: string; quantity: string; unit: string; lowStockThreshold: string; unitCost: string; supplierId: string }) {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), quantity: Number(input.quantity) || 0, unit: input.unit.trim() || "unité", low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null, unit_cost: Number(input.unitCost) || 0, supplier_id: input.supplierId || null })
      .select("*")
      .single();
    if (!error && data) setInventory((prev) => [data, ...prev]);
  }
  async function updateInventoryItem(id: string, patch: Partial<InventoryItem>) {
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
    if (!error) setInventory((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  async function removeInventoryItem(id: string) {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (!error) setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  async function createSupplier(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase.from("suppliers").insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() }).select("*").single();
    if (!error && data) setSuppliers((prev) => [data, ...prev]);
  }
  async function updateSupplier(id: string, patch: Partial<Supplier>) {
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    if (!error) setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function removeSupplier(id: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (!error) setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  async function createPurchaseOrder(supplierId: string) {
    const { data, error } = await supabase.from("purchase_orders").insert({ workspace_id: workspaceId, supplier_id: supplierId, status: "draft" }).select("*").single();
    if (!error && data) setPurchaseOrders((prev) => [data, ...prev]);
  }
  async function setPurchaseOrderStatus(order: PurchaseOrder, status: PurchaseOrder["status"]) {
    const patch: Partial<PurchaseOrder> = { status };
    if (status === "ordered" && !order.ordered_at) patch.ordered_at = new Date().toISOString().slice(0, 10);
    if (status === "received" && !order.received_at) patch.received_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("purchase_orders").update(patch).eq("id", order.id);
    if (!error) setPurchaseOrders((prev) => prev.map((p) => (p.id === order.id ? { ...p, ...patch } : p)));
  }
  async function removePurchaseOrder(id: string) {
    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (!error) setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
  }
  async function addPurchaseOrderItem(orderId: string, input: { inventoryItemId: string; itemName: string; quantity: number; unitCost: number }) {
    const { data, error } = await supabase
      .from("purchase_order_items")
      .insert({ workspace_id: workspaceId, purchase_order_id: orderId, inventory_item_id: input.inventoryItemId || null, item_name: input.itemName, quantity: input.quantity, unit_cost: input.unitCost })
      .select("*")
      .single();
    if (error || !data) return;
    setPurchaseOrderItems((prev) => [...prev, data]);
    const newItems = [...purchaseOrderItems, data].filter((i) => i.purchase_order_id === orderId);
    const total = newItems.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
    await supabase.from("purchase_orders").update({ total_cost: total }).eq("id", orderId);
    setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, total_cost: total } : p)));
  }
  async function removePurchaseOrderItem(item: PurchaseOrderItem) {
    const { error } = await supabase.from("purchase_order_items").delete().eq("id", item.id);
    if (error) return;
    setPurchaseOrderItems((prev) => prev.filter((i) => i.id !== item.id));
    const remaining = purchaseOrderItems.filter((i) => i.purchase_order_id === item.purchase_order_id && i.id !== item.id);
    const total = remaining.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
    await supabase.from("purchase_orders").update({ total_cost: total }).eq("id", item.purchase_order_id);
    setPurchaseOrders((prev) => prev.map((p) => (p.id === item.purchase_order_id ? { ...p, total_cost: total } : p)));
  }

  async function createRecipe(input: { name: string; sellingPrice: string }) {
    const { data, error } = await supabase.from("recipes").insert({ workspace_id: workspaceId, name: input.name.trim(), selling_price: Number(input.sellingPrice) || 0 }).select("*").single();
    if (!error && data) setRecipes((prev) => [data, ...prev]);
  }
  async function updateRecipe(id: string, patch: Partial<Recipe>) {
    const { error } = await supabase.from("recipes").update(patch).eq("id", id);
    if (!error) setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  async function removeRecipe(id: string) {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (!error) setRecipes((prev) => prev.filter((r) => r.id !== id));
  }
  async function addRecipeIngredient(recipeId: string, input: { inventoryItemId: string; itemName: string; quantity: number; unitCost: number }) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .insert({ workspace_id: workspaceId, recipe_id: recipeId, inventory_item_id: input.inventoryItemId || null, item_name: input.itemName, quantity: input.quantity, unit_cost: input.unitCost })
      .select("*")
      .single();
    if (!error && data) setRecipeIngredients((prev) => [...prev, data]);
  }
  async function removeRecipeIngredient(ingredient: RecipeIngredient) {
    const { error } = await supabase.from("recipe_ingredients").delete().eq("id", ingredient.id);
    if (!error) setRecipeIngredients((prev) => prev.filter((i) => i.id !== ingredient.id));
  }

  async function createTeamMember(input: { name: string; role: string; phone: string; email: string }) {
    const { data, error } = await supabase.from("team_members").insert({ workspace_id: workspaceId, name: input.name.trim(), role: input.role.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null }).select("*").single();
    if (!error && data) setTeamMembers((prev) => [...prev, data]);
  }
  async function updateTeamMember(id: string, patch: Partial<TeamMember>) {
    const { error } = await supabase.from("team_members").update(patch).eq("id", id);
    if (!error) setTeamMembers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function removeTeamMember(id: string) {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (!error) setTeamMembers((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn("rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition-colors", active === t.key ? "bg-panel text-ink shadow-[0_1px_0_0_var(--panel)]" : "text-muted hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "dashboard" && (
        <RestaurantDashboard inventory={inventory} wasteLog={initialWasteLog} purchaseOrders={purchaseOrders} recipes={recipes} recipeIngredients={recipeIngredients} alerts={alerts} />
      )}
      {active === "customers" && (
        <CustomersModule workspaceId={workspaceId} initial={customers} label="Clients" controlled={{ rows: customers, onCreate: createCustomer, onUpdate: updateCustomer, onRemove: removeCustomer }} />
      )}
      {active === "inventory" && (
        <InventoryModule
          workspaceId={workspaceId}
          initial={inventory}
          label="Stocks & Ingrédients"
          suppliers={suppliers}
          controlled={{ rows: inventory, onCreate: createInventoryItem, onUpdate: updateInventoryItem, onRemove: removeInventoryItem }}
        />
      )}
      {active === "suppliers" && <SuppliersModule rows={suppliers} onCreate={createSupplier} onUpdate={updateSupplier} onRemove={removeSupplier} />}
      {active === "purchase_orders" && (
        <PurchaseOrdersModule
          rows={purchaseOrders}
          items={purchaseOrderItems}
          suppliers={suppliers}
          inventory={inventory}
          onCreate={createPurchaseOrder}
          onSetStatus={setPurchaseOrderStatus}
          onAddItem={addPurchaseOrderItem}
          onRemoveItem={removePurchaseOrderItem}
          onRemove={removePurchaseOrder}
        />
      )}
      {active === "waste" && <WasteLogModule workspaceId={workspaceId} initial={initialWasteLog} />}
      {active === "recipes" && (
        <RecipesModule rows={recipes} ingredients={recipeIngredients} inventory={inventory} onCreate={createRecipe} onUpdate={updateRecipe} onRemove={removeRecipe} onAddIngredient={addRecipeIngredient} onRemoveIngredient={removeRecipeIngredient} />
      )}
      {active === "planning" && <AppointmentsModule workspaceId={workspaceId} initial={initialAppointments} label="Réservations" />}
      {active === "team" && <TeamModule label="Équipe" rows={teamMembers} onCreate={createTeamMember} onUpdate={updateTeamMember} onRemove={removeTeamMember} />}
    </div>
  );
}
