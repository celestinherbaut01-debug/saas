"use client";

import { useState } from "react";
import type { Part, Supplier } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/garage";

interface PartInput {
  name: string;
  reference: string;
  supplierId: string;
  unitCost: string;
  unitPrice: string;
  quantity: string;
  lowStockThreshold: string;
}

export function PartsModule({
  rows,
  suppliers,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: Part[];
  suppliers: Supplier[];
  onCreate: (input: PartInput) => void;
  onUpdate: (id: string, patch: Partial<Part>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);

  function supplierName(id: string | null) {
    return id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Pièces</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter une pièce
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🔩" title="Aucune pièce au catalogue" description="Ajoutez vos pièces (référence, coût, prix de vente) pour les utiliser sur les ordres de réparation." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter une pièce</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Pièce</Th>
                  <Th>Référence</Th>
                  <Th>Fournisseur</Th>
                  <Th className="text-right">Coût</Th>
                  <Th className="text-right">Prix de vente</Th>
                  <Th className="text-right">Stock</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((p) => {
                  const low = p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold;
                  return (
                    <Tr key={p.id} onClick={() => setEditing(p)}>
                      <Td className="font-semibold text-ink">{p.name}</Td>
                      <Td className="text-muted">{p.reference || "—"}</Td>
                      <Td className="text-muted">{supplierName(p.supplier_id)}</Td>
                      <Td className="text-right text-muted">{formatEUR(p.unit_cost)}</Td>
                      <Td className="text-right font-semibold">{formatEUR(p.unit_price)}</Td>
                      <Td className="text-right">
                        <span className="inline-flex items-center gap-1.5">
                          {p.quantity} {p.unit}
                          {low && <Badge tone="danger">Bas</Badge>}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <PartDrawer open={createOpen} title="Ajouter une pièce" initial={null} suppliers={suppliers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <PartDrawer
          open
          title={editing.name}
          initial={editing}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, {
              name: input.name.trim(),
              reference: input.reference.trim(),
              supplier_id: input.supplierId || null,
              unit_cost: Number(input.unitCost) || 0,
              unit_price: Number(input.unitPrice) || 0,
              quantity: Number(input.quantity) || 0,
              low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null,
            });
            setEditing(null);
          }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function PartDrawer({
  open,
  title,
  initial,
  suppliers,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: Part | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSubmit: (input: PartInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [unitCost, setUnitCost] = useState(initial ? String(initial.unit_cost) : "0");
  const [unitPrice, setUnitPrice] = useState(initial ? String(initial.unit_price) : "0");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "0");
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.low_stock_threshold != null ? String(initial.low_stock_threshold) : "");

  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Nom
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Référence
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Fournisseur
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Coût d&apos;achat (€)
            <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Prix de vente (€)
            <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Quantité en stock
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Seuil de stock bas
            <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => onSubmit({ name, reference, supplierId, unitCost, unitPrice, quantity, lowStockThreshold })}
          disabled={!name.trim()}
        >
          Enregistrer
        </Button>
        {onDelete && (
          <Button variant="outline" onClick={onDelete}>
            Supprimer
          </Button>
        )}
      </div>
    </Drawer>
  );
}
