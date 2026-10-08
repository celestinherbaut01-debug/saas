"use client";

import { useState } from "react";
import type { InventoryItem, Supplier, SupplierOrder, SupplierOrderItem } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { ORDER_STATUS_LABEL } from "@/lib/butcher";

const STATUS_ORDER: SupplierOrder["status"][] = ["draft", "sent", "confirmed", "received", "canceled"];

export function OrdersModule({
  rows,
  items,
  lines,
  suppliers,
  onCreate,
  onSetStatus,
  onRemove,
  onAddLine,
  onRemoveLine,
}: {
  rows: SupplierOrder[];
  items: InventoryItem[];
  lines: SupplierOrderItem[];
  suppliers: Supplier[];
  onCreate: (input: { supplierId: string; expectedAt: string; notes: string }) => void;
  onSetStatus: (order: SupplierOrder, status: SupplierOrder["status"]) => void;
  onRemove: (id: string, mode: "archive" | "delete") => void;
  onAddLine: (orderId: string, input: { itemId: string; quantity: string; unitCost: string }) => void;
  onRemoveLine: (line: SupplierOrderItem) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const sorted = [...rows].sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());
  const detail = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  function supplierName(id: string) {
    return suppliers.find((s) => s.id === id)?.name ?? "—";
  }
  function linesOf(orderId: string) {
    return lines.filter((l) => l.order_id === orderId);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">
          Commandes fournisseurs <span className="font-normal text-faint">({rows.length})</span>
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={suppliers.length === 0}>
          + Nouvelle commande
        </Button>
      </div>
      {suppliers.length === 0 && <p className="mt-2 text-[11px] text-faint">Ajoutez un fournisseur avant de créer une commande.</p>}

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🧾" title="Aucune commande" description="Passez une commande à un fournisseur pour réapprovisionner votre stock." />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Fournisseur</Th>
                  <Th>Commandée le</Th>
                  <Th>Attendue le</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((o) => (
                  <Tr key={o.id} onClick={() => setDetailId(o.id)}>
                    <Td className="font-semibold text-ink">{supplierName(o.supplier_id)}</Td>
                    <Td className="text-muted">{new Date(o.ordered_at).toLocaleDateString("fr-FR")}</Td>
                    <Td className="text-muted">{o.expected_at ? new Date(o.expected_at).toLocaleDateString("fr-FR") : "—"}</Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_LABEL[o.status].tone}>{ORDER_STATUS_LABEL[o.status].text}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <CreateOrderDrawer open={createOpen} suppliers={suppliers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />

      {detail && (
        <Drawer open onClose={() => setDetailId(null)} title={`Commande — ${supplierName(detail.supplier_id)}`} width="lg">
          <OrderDetail
            order={detail}
            items={items}
            lines={linesOf(detail.id)}
            onSetStatus={(s) => onSetStatus(detail, s)}
            onAddLine={(input) => onAddLine(detail.id, input)}
            onRemoveLine={onRemoveLine}
            onRemove={(mode) => {
              onRemove(detail.id, mode);
              setDetailId(null);
            }}
          />
        </Drawer>
      )}
    </Card>
  );
}

function OrderDetail({
  order,
  items,
  lines,
  onSetStatus,
  onAddLine,
  onRemoveLine,
  onRemove,
}: {
  order: SupplierOrder;
  items: InventoryItem[];
  lines: SupplierOrderItem[];
  onSetStatus: (status: SupplierOrder["status"]) => void;
  onAddLine: (input: { itemId: string; quantity: string; unitCost: string }) => void;
  onRemoveLine: (line: SupplierOrderItem) => void;
  onRemove: (mode: "archive" | "delete") => void;
}) {
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");

  function itemName(id: string) {
    return items.find((i) => i.id === id)?.name ?? "—";
  }

  function submitLine() {
    if (!itemId || !quantity) return;
    onAddLine({ itemId, quantity, unitCost });
    setItemId("");
    setQuantity("");
    setUnitCost("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSetStatus(s)}
            className={
              s === order.status
                ? "rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-ink shadow-[var(--shadow-sm)]"
                : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"
            }
          >
            {ORDER_STATUS_LABEL[s].text}
          </button>
        ))}
      </div>

      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Produits commandés</p>
        {lines.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                <span>
                  {itemName(l.item_id)} <span className="text-faint">× {l.quantity}</span>
                </span>
                <span className="flex items-center gap-2">
                  {l.unit_cost != null && <span className="font-semibold">{(l.unit_cost * l.quantity).toFixed(2)} €</span>}
                  <button onClick={() => onRemoveLine(l)} className="text-[11px] text-faint hover:text-red-fg">
                    Retirer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Select className="h-9 flex-1" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Choisir un produit…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
          <Input type="number" min="0" step="0.01" placeholder="Qté" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 w-20" />
          <Input type="number" min="0" step="0.01" placeholder="Coût unit." value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="h-9 w-24" />
          <Button size="sm" onClick={submitLine} disabled={!itemId || !quantity}>
            Ajouter
          </Button>
        </div>
      </div>

      <ConfirmDeleteButton itemLabel="cette commande" onArchive={() => onRemove("archive")} onConfirm={() => onRemove("delete")} />
    </div>
  );
}

function CreateOrderDrawer({
  open,
  suppliers,
  onClose,
  onSubmit,
}: {
  open: boolean;
  suppliers: Supplier[];
  onClose: () => void;
  onSubmit: (input: { supplierId: string; expectedAt: string; notes: string }) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  if (!open) return null;

  function submit() {
    if (!supplierId) return;
    onSubmit({ supplierId, expectedAt, notes });
    setSupplierId("");
    setExpectedAt("");
    setNotes("");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouvelle commande fournisseur" subtitle="Étape 1 : les produits se gèrent ensuite dans le détail de la commande.">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Fournisseur
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Choisir…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Livraison attendue le (optionnel)
          <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes (optionnel)
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={submit} disabled={!supplierId} className="w-full">
          Créer la commande
        </Button>
      </div>
    </Drawer>
  );
}
