"use client";

import { useState } from "react";
import type { GoodsReception, InventoryItem, InventoryMovement, Supplier, SupplierOrder } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";

export interface ReceptionLineInput {
  itemId: string;
  quantity: string;
  unitCost: string;
  lotNumber: string;
  expiresOn: string;
}

// Une réception = un en-tête (goods_receptions) + ses lignes, qui SONT les
// inventory_movements de type "reception" portant reception_id — pas une
// table de lignes séparée, pour garder un seul historique de mouvements.
export function ReceptionsModule({
  rows,
  movements,
  items,
  suppliers,
  orders,
  onCreate,
}: {
  rows: GoodsReception[];
  movements: InventoryMovement[];
  items: InventoryItem[];
  suppliers: Supplier[];
  orders: SupplierOrder[];
  onCreate: (input: { supplierId: string; orderId: string; notes: string; lines: ReceptionLineInput[] }) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const sorted = [...rows].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

  function itemName(id: string) {
    return items.find((i) => i.id === id)?.name ?? "—";
  }
  function supplierName(id: string | null) {
    return id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";
  }
  function linesOf(receptionId: string) {
    return movements.filter((m) => m.reception_id === receptionId);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">
          Réceptions <span className="font-normal text-faint">({rows.length})</span>
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Enregistrer une réception
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📦" title="Aucune réception" description="Enregistrez une réception pour mettre à jour votre stock et suivre les lots." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Enregistrer une réception</Button>} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {sorted.map((r) => {
            const lines = linesOf(r.id);
            return (
              <div key={r.id} className="rounded-xl border border-line bg-soft p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-ink">
                    {new Date(r.received_at).toLocaleDateString("fr-FR")} — {supplierName(r.supplier_id)}
                  </p>
                  <span className="text-[11px] text-faint">{lines.length} produit{lines.length > 1 ? "s" : ""}</span>
                </div>
                {lines.length > 0 && (
                  <div className="mt-2">
                  <TableWrap>
                    <Table>
                      <Thead>
                        <tr>
                          <Th>Produit</Th>
                          <Th className="text-right">Quantité</Th>
                          <Th className="text-right">Coût unitaire</Th>
                          <Th>Lot / DLC</Th>
                        </tr>
                      </Thead>
                      <tbody>
                        {lines.map((l) => (
                          <Tr key={l.id}>
                            <Td className="font-semibold text-ink">{itemName(l.item_id)}</Td>
                            <Td className="text-right">+{l.quantity_delta}</Td>
                            <Td className="text-right text-muted">{l.unit_cost != null ? `${l.unit_cost.toFixed(2)} €` : "—"}</Td>
                            <Td className="text-muted">
                              {l.lot_number ? `Lot ${l.lot_number}` : "—"}
                              {l.expires_on ? ` · DLC ${new Date(l.expires_on).toLocaleDateString("fr-FR")}` : ""}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                  </div>
                )}
                {r.notes && <p className="mt-2 text-[11.5px] text-faint">{r.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <ReceptionDrawer
        open={createOpen}
        items={items}
        suppliers={suppliers}
        orders={orders}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => {
          onCreate(input);
          setCreateOpen(false);
        }}
      />
    </Card>
  );
}

function ReceptionDrawer({
  open,
  items,
  suppliers,
  orders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  items: InventoryItem[];
  suppliers: Supplier[];
  orders: SupplierOrder[];
  onClose: () => void;
  onSubmit: (input: { supplierId: string; orderId: string; notes: string; lines: ReceptionLineInput[] }) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceptionLineInput[]>([{ itemId: "", quantity: "", unitCost: "", lotNumber: "", expiresOn: "" }]);
  if (!open) return null;

  const pendingOrders = orders.filter((o) => (!supplierId || o.supplier_id === supplierId) && (o.status === "sent" || o.status === "confirmed"));

  function updateLine(i: number, patch: Partial<ReceptionLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { itemId: "", quantity: "", unitCost: "", lotNumber: "", expiresOn: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const validLines = lines.filter((l) => l.itemId && l.quantity);

  function submit() {
    if (validLines.length === 0) return;
    onSubmit({ supplierId, orderId, notes, lines: validLines });
    setSupplierId("");
    setOrderId("");
    setNotes("");
    setLines([{ itemId: "", quantity: "", unitCost: "", lotNumber: "", expiresOn: "" }]);
  }

  return (
    <Drawer open={open} onClose={onClose} title="Enregistrer une réception" width="lg">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Fournisseur (optionnel)
            <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setOrderId(""); }}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Commande liée (optionnel)
            <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">—</option>
              {pendingOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  Commande du {new Date(o.ordered_at).toLocaleDateString("fr-FR")}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <p className="text-[12px] font-semibold text-muted">Produits reçus</p>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-line bg-soft p-2">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                <Select className="sm:col-span-2" value={l.itemId} onChange={(e) => updateLine(i, { itemId: e.target.value })}>
                  <option value="">Produit…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Quantité" type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                <Input placeholder="Coût unitaire" type="number" step="0.01" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} />
                <button type="button" onClick={() => removeLine(i)} className="text-[11px] text-faint hover:text-red-fg">
                  Retirer
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Input placeholder="Numéro de lot (optionnel)" value={l.lotNumber} onChange={(e) => updateLine(i, { lotNumber: e.target.value })} />
                <label className="flex items-center gap-1.5 text-[11px] text-muted">
                  DLC (optionnel)
                  <Input type="date" value={l.expiresOn} onChange={(e) => updateLine(i, { expiresOn: e.target.value })} className="h-8" />
                </label>
              </div>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={addLine}>
          + Ajouter un produit
        </Button>

        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes (optionnel)
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={submit} disabled={validLines.length === 0} className="w-full">
          Enregistrer la réception
        </Button>
      </div>
    </Drawer>
  );
}
