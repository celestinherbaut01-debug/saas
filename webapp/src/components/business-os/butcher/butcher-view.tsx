"use client";

import { useMemo, useState } from "react";
import type {
  Customer,
  Supplier,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  SupplierOrder,
  SupplierOrderItem,
  GoodsReception,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { computeButcherAlerts } from "@/lib/butcher";
import { computeButcherCommandCenter } from "@/lib/command-center";
import { CommandCenter } from "@/components/business-os/command-center";
import { CustomersModule } from "@/components/business-os/customers-module";
import { SuppliersModule } from "@/components/business-os/garage/garage-suppliers";
import { ProductsModule } from "@/components/business-os/butcher/butcher-products";
import { MovementsModule } from "@/components/business-os/butcher/butcher-movements";
import { ReceptionsModule } from "@/components/business-os/butcher/butcher-receptions";
import { OrdersModule } from "@/components/business-os/butcher/butcher-orders";
import { AlertsModule } from "@/components/business-os/garage/garage-alerts";

type Tab = "today" | "products" | "movements" | "receptions" | "orders" | "customers" | "suppliers" | "alerts";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "products", label: "Produits" },
  { key: "movements", label: "Mouvements" },
  { key: "receptions", label: "Réceptions" },
  { key: "orders", label: "Commandes" },
  { key: "customers", label: "Clients" },
  { key: "suppliers", label: "Fournisseurs" },
  { key: "alerts", label: "Alertes" },
];

/**
 * Seul propriétaire de l'état Boucherie OS. Tous les mutateurs font un
 * appel Supabase direct puis mettent à jour l'état local (pas de
 * transaction DB côté client, comme partout ailleurs dans ce Business OS) :
 * une erreur partielle est signalée via mutationError plutôt qu'annulée.
 */
export function ButcherView({
  workspaceId,
  initialCustomers,
  initialSuppliers,
  initialCategories,
  initialItems,
  initialMovements,
  initialOrders,
  initialOrderItems,
  initialReceptions,
}: {
  workspaceId: string;
  initialCustomers: Customer[];
  initialSuppliers: Supplier[];
  initialCategories: InventoryCategory[];
  initialItems: InventoryItem[];
  initialMovements: InventoryMovement[];
  initialOrders: SupplierOrder[];
  initialOrderItems: SupplierOrderItem[];
  initialReceptions: GoodsReception[];
}) {
  const supabase = createClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [active, setActive] = useState<Tab>("today");

  const [customers, setCustomers] = useState(initialCustomers);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [movements, setMovements] = useState(initialMovements);
  const [orders, setOrders] = useState(initialOrders);
  const [orderItems, setOrderItems] = useState(initialOrderItems);
  const [receptions, setReceptions] = useState(initialReceptions);

  const alerts = useMemo(() => computeButcherAlerts({ items, movements, orders }), [items, movements, orders]);
  const commandCenter = useMemo(() => computeButcherCommandCenter({ items, movements, orders }), [items, movements, orders]);

  function handleCommandCenterNavigate(tab: string, detailId?: string) {
    setFocusId(detailId ?? null);
    setActive(tab as Tab);
  }

  // --- Clients (générique) ---
  async function createCustomer(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase
      .from("customers")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() })
      .select("*")
      .single();
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    if (data) setCustomers((prev) => [data, ...prev]);
  }
  async function updateCustomer(id: string, patch: Partial<Customer>) {
    const { error } = await supabase.from("customers").update(patch).eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function removeCustomer(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("customers").delete().eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  // --- Fournisseurs ---
  async function createSupplier(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() })
      .select("*")
      .single();
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    if (data) setSuppliers((prev) => [data, ...prev]);
  }
  async function updateSupplier(id: string, patch: Partial<Supplier>) {
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function removeSupplier(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("suppliers").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("suppliers").delete().eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  // --- Catégories ---
  async function createCategory(name: string) {
    const { data, error } = await supabase
      .from("inventory_categories")
      .insert({ workspace_id: workspaceId, name, sort_order: categories.length })
      .select("*")
      .single();
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    if (data) setCategories((prev) => [...prev, data]);
  }

  // --- Produits ---
  async function createProduct(input: { name: string; categoryId: string; reference: string; unit: string; quantity: string; lowStockThreshold: string; unitCost: string; unitPrice: string; supplierId: string }) {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        workspace_id: workspaceId,
        name: input.name.trim(),
        category_id: input.categoryId || null,
        reference: input.reference.trim(),
        unit: input.unit,
        quantity: Number(input.quantity) || 0,
        low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null,
        unit_cost: Number(input.unitCost) || 0,
        unit_price: input.unitPrice ? Number(input.unitPrice) : null,
        supplier_id: input.supplierId || null,
      })
      .select("*")
      .single();
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    if (data) setItems((prev) => [data, ...prev]);
  }
  async function updateProduct(id: string, patch: Partial<InventoryItem>) {
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  async function removeProduct(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("inventory_items").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("inventory_items").delete().eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // --- Mouvements (pertes / ajustements) ---
  async function recordMovement(input: { itemId: string; type: InventoryMovement["type"]; quantityDelta: number; reason: string; unitCost?: number | null; lotNumber?: string | null; expiresOn?: string | null; receptionId?: string | null }) {
    const { data, error } = await supabase
      .from("inventory_movements")
      .insert({
        workspace_id: workspaceId,
        item_id: input.itemId,
        type: input.type,
        quantity_delta: input.quantityDelta,
        reason: input.reason.trim(),
        unit_cost: input.unitCost ?? null,
        lot_number: input.lotNumber ?? null,
        expires_on: input.expiresOn ?? null,
        reception_id: input.receptionId ?? null,
      })
      .select("*")
      .single();
    if (error || !data) { setMutationError(error?.message ?? "Enregistrement impossible."); return null; }
    setMutationError(null);
    setMovements((prev) => [data, ...prev]);
    const item = items.find((i) => i.id === input.itemId);
    if (item) await updateProduct(item.id, { quantity: Math.max(0, item.quantity + input.quantityDelta) });
    return data;
  }

  async function declareLoss(input: { itemId: string; quantity: string; reason: string }) {
    const qty = Number(input.quantity);
    if (!qty) return;
    await recordMovement({ itemId: input.itemId, type: "loss", quantityDelta: -Math.abs(qty), reason: input.reason || "Perte" });
  }

  async function adjustStock(input: { itemId: string; quantity: string; reason: string }) {
    const item = items.find((i) => i.id === input.itemId);
    if (!item) return;
    const target = Number(input.quantity);
    const delta = target - item.quantity;
    if (!delta) return;
    await recordMovement({ itemId: input.itemId, type: "adjustment", quantityDelta: delta, reason: input.reason || "Ajustement" });
  }

  // --- Réceptions ---
  async function createReception(input: { supplierId: string; orderId: string; notes: string; lines: { itemId: string; quantity: string; unitCost: string; lotNumber: string; expiresOn: string }[] }) {
    const { data, error } = await supabase
      .from("goods_receptions")
      .insert({ workspace_id: workspaceId, supplier_id: input.supplierId || null, order_id: input.orderId || null, notes: input.notes.trim() })
      .select("*")
      .single();
    if (error || !data) { setMutationError(error?.message ?? "Enregistrement impossible."); return; }
    setMutationError(null);
    setReceptions((prev) => [data, ...prev]);

    for (const line of input.lines) {
      await recordMovement({
        itemId: line.itemId,
        type: "reception",
        quantityDelta: Math.abs(Number(line.quantity)) || 0,
        reason: "Réception",
        unitCost: line.unitCost ? Number(line.unitCost) : null,
        lotNumber: line.lotNumber.trim() || null,
        expiresOn: line.expiresOn || null,
        receptionId: data.id,
      });
    }

    if (input.orderId) {
      await setOrderStatus(orders.find((o) => o.id === input.orderId) ?? null, "received");
    }
  }

  // --- Commandes fournisseurs ---
  async function createOrder(input: { supplierId: string; expectedAt: string; notes: string }) {
    const { data, error } = await supabase
      .from("supplier_orders")
      .insert({ workspace_id: workspaceId, supplier_id: input.supplierId, expected_at: input.expectedAt || null, notes: input.notes.trim() })
      .select("*")
      .single();
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    if (data) setOrders((prev) => [data, ...prev]);
  }
  async function setOrderStatus(order: SupplierOrder | null, status: SupplierOrder["status"]) {
    if (!order) return;
    const { error } = await supabase.from("supplier_orders").update({ status }).eq("id", order.id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
  }
  async function removeOrder(id: string, mode: "archive" | "delete") {
    const { error } = mode === "archive" ? await supabase.from("supplier_orders").update({ status: "canceled" }).eq("id", id) : await supabase.from("supplier_orders").delete().eq("id", id);
    if (error) { setMutationError(error.message); return; }
    setMutationError(null);
    if (mode === "delete") setOrders((prev) => prev.filter((o) => o.id !== id));
    else setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "canceled" } : o)));
  }
  async function addOrderLine(orderId: string, input: { itemId: string; quantity: string; unitCost: string }) {
    const { data, error } = await supabase
      .from("supplier_order_items")
      .insert({ workspace_id: workspaceId, order_id: orderId, item_id: input.itemId, quantity: Number(input.quantity) || 0, unit_cost: input.unitCost ? Number(input.unitCost) : null })
      .select("*")
      .single();
    if (error || !data) { setMutationError(error?.message ?? "Enregistrement impossible."); return; }
    setMutationError(null);
    setOrderItems((prev) => [...prev, data]);
  }
  async function removeOrderLine(line: SupplierOrderItem) {
    const { error } = await supabase.from("supplier_order_items").delete().eq("id", line.id);
    if (error) { setMutationError(error.message); return; }
    setOrderItems((prev) => prev.filter((l) => l.id !== line.id));
  }

  return (
    <div className="flex flex-col gap-5">
      {mutationError && <p role="alert" className="rounded-xl bg-red-bg p-3 text-sm text-red-fg">{mutationError}</p>}
      <div className="pf-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setFocusId(null); setActive(t.key); }}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition-colors",
              active === t.key ? "bg-panel text-ink shadow-[0_1px_0_0_var(--panel)]" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "today" && <CommandCenter data={commandCenter} onNavigate={handleCommandCenterNavigate} entityName="boucherie" />}
      {active === "products" && (
        <ProductsModule key={`${active}-${focusId}`} initialFocusId={focusId} rows={items} categories={categories} suppliers={suppliers} onCreate={createProduct} onUpdate={updateProduct} onRemove={removeProduct} onCreateCategory={createCategory} />
      )}
      {active === "movements" && <MovementsModule rows={movements} items={items} onDeclareLoss={declareLoss} onAdjust={adjustStock} />}
      {active === "receptions" && <ReceptionsModule rows={receptions} movements={movements} items={items} suppliers={suppliers} orders={orders} onCreate={createReception} />}
      {active === "orders" && (
        <OrdersModule rows={orders} items={items} lines={orderItems} suppliers={suppliers} onCreate={createOrder} onSetStatus={(o, s) => setOrderStatus(o, s)} onRemove={removeOrder} onAddLine={addOrderLine} onRemoveLine={removeOrderLine} />
      )}
      {active === "customers" && (
        <CustomersModule workspaceId={workspaceId} initial={customers} label="Clients" controlled={{ rows: customers, onCreate: createCustomer, onUpdate: updateCustomer, onRemove: removeCustomer }} />
      )}
      {active === "suppliers" && <SuppliersModule rows={suppliers} onCreate={createSupplier} onUpdate={updateSupplier} onRemove={removeSupplier} />}
      {active === "alerts" && <AlertsModule alerts={alerts.map((a) => ({ level: a.level, text: a.text }))} advanced />}
    </div>
  );
}
