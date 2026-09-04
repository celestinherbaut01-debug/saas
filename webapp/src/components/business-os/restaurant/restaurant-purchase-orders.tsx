"use client";

import { useState } from "react";
import type { PurchaseOrder, PurchaseOrderItem, Supplier, InventoryItem } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PURCHASE_ORDER_STATUS_LABEL, formatEUR } from "@/lib/restaurant";

// "Commandes" + "Réceptions" consolidées : un même bon de commande
// fournisseur qui change de statut (commandé -> reçu), pas deux tables
// couplées pour une seule réalité opérationnelle.
export function PurchaseOrdersModule({
  rows,
  items,
  suppliers,
  inventory,
  onCreate,
  onSetStatus,
  onAddItem,
  onRemoveItem,
  onRemove,
}: {
  rows: PurchaseOrder[];
  items: PurchaseOrderItem[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  onCreate: (supplierId: string) => void;
  onSetStatus: (order: PurchaseOrder, status: PurchaseOrder["status"]) => void;
  onAddItem: (orderId: string, input: { inventoryItemId: string; itemName: string; quantity: number; unitCost: number }) => void;
  onRemoveItem: (item: PurchaseOrderItem) => void;
  onRemove: (id: string) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  function supplierName(id: string | null) {
    return id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";
  }
  function itemsOf(orderId: string) {
    return items.filter((i) => i.purchase_order_id === orderId);
  }

  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const detailOrder = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Commandes fournisseurs</h2>
        <div className="flex gap-1.5">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Fournisseur…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => { onCreate(supplierId); setSupplierId(""); }} disabled={!supplierId}>
            + Nouvelle commande
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📦" title="Aucune commande" description="Choisissez un fournisseur pour créer une commande." />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Fournisseur</Th>
                  <Th>Créée le</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((po) => (
                  <Tr key={po.id} onClick={() => setDetailId(po.id)}>
                    <Td className="font-semibold text-ink">{supplierName(po.supplier_id)}</Td>
                    <Td className="text-muted">{new Date(po.created_at).toLocaleDateString("fr-FR")}</Td>
                    <Td className="text-right font-semibold">{formatEUR(po.total_cost)}</Td>
                    <Td>
                      <Badge tone={PURCHASE_ORDER_STATUS_LABEL[po.status].tone}>{PURCHASE_ORDER_STATUS_LABEL[po.status].text}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      {detailOrder && (
        <PurchaseOrderDetail
          order={detailOrder}
          items={itemsOf(detailOrder.id)}
          inventory={inventory}
          supplierName={supplierName(detailOrder.supplier_id)}
          onClose={() => setDetailId(null)}
          onSetStatus={(s) => onSetStatus(detailOrder, s)}
          onAddItem={(input) => onAddItem(detailOrder.id, input)}
          onRemoveItem={onRemoveItem}
          onRemove={() => { onRemove(detailOrder.id); setDetailId(null); }}
        />
      )}
    </Card>
  );
}

function PurchaseOrderDetail({
  order,
  items,
  inventory,
  supplierName,
  onClose,
  onSetStatus,
  onAddItem,
  onRemoveItem,
  onRemove,
}: {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
  inventory: InventoryItem[];
  supplierName: string;
  onClose: () => void;
  onSetStatus: (status: PurchaseOrder["status"]) => void;
  onAddItem: (input: { inventoryItemId: string; itemName: string; quantity: number; unitCost: number }) => void;
  onRemoveItem: (item: PurchaseOrderItem) => void;
  onRemove: () => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");

  function submit() {
    const item = inventory.find((i) => i.id === selectedItemId);
    if (!item) return;
    onAddItem({ inventoryItemId: item.id, itemName: item.name, quantity: Number(quantity) || 1, unitCost: item.unit_cost });
    setSelectedItemId("");
    setQuantity("1");
  }

  return (
    <Drawer open onClose={onClose} title={supplierName} subtitle={`Commande du ${new Date(order.created_at).toLocaleDateString("fr-FR")}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PURCHASE_ORDER_STATUS_LABEL) as PurchaseOrder["status"][]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSetStatus(s)}
              className={s === order.status ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg" : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"}
            >
              {PURCHASE_ORDER_STATUS_LABEL[s].text}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Articles</p>
          {items.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                  <span>
                    {i.item_name} <span className="text-faint">× {i.quantity}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{formatEUR(i.unit_cost * i.quantity)}</span>
                    <button onClick={() => onRemoveItem(i)} className="text-[11px] text-faint hover:text-red-fg">
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
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 w-16" />
            <Button size="sm" onClick={submit} disabled={!selectedItemId}>
              Ajouter
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-soft px-3 py-2.5">
          <span className="text-[12px] font-semibold text-muted">Total commande</span>
          <span className="font-display text-[15px] font-extrabold">{formatEUR(items.reduce((s, i) => s + i.unit_cost * i.quantity, 0))}</span>
        </div>

        <button type="button" onClick={onRemove} className="self-start text-[11.5px] font-semibold text-faint hover:text-red-fg">
          Supprimer cette commande
        </button>
      </div>
    </Drawer>
  );
}
