"use client";

import { useState } from "react";
import type { InventoryItem, Supplier } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ItemInput {
  name: string;
  quantity: string;
  unit: string;
  lowStockThreshold: string;
  unitCost: string;
  supplierId: string;
}

interface ControlledInventory {
  rows: InventoryItem[];
  onCreate: (input: ItemInput) => void;
  onUpdate: (id: string, patch: Partial<InventoryItem>) => void;
  onRemove: (id: string) => void;
}

// Composant partagé (générique/nettoyage/restaurant) — "Stock" couvre à la
// fois Matériel, Consommables et Ingrédients selon le métier : un seul
// tableau réel plutôt que 3 modules quasi identiques. `suppliers` et le
// mode `controlled` sont utilisés par Restaurant (le sélecteur de
// fournisseur d'un ingrédient doit voir les fournisseurs à jour).
export function InventoryModule({
  workspaceId,
  initial,
  label,
  suppliers = [],
  controlled,
}: {
  workspaceId: string;
  initial: InventoryItem[];
  label: string;
  suppliers?: Supplier[];
  controlled?: ControlledInventory;
}) {
  const supabase = createClient();
  const [localRows, setLocalRows] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const rows = controlled ? controlled.rows : localRows;

  function supplierName(id: string | null) {
    return id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";
  }

  async function create(input: ItemInput) {
    if (!input.name.trim()) return;
    if (controlled) {
      controlled.onCreate(input);
      setCreateOpen(false);
      return;
    }
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        workspace_id: workspaceId,
        name: input.name.trim(),
        quantity: Number(input.quantity) || 0,
        unit: input.unit.trim() || "unité",
        low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null,
        unit_cost: Number(input.unitCost) || 0,
        supplier_id: input.supplierId || null,
      })
      .select("*")
      .single();
    if (!error && data) {
      setLocalRows((prev) => [data, ...prev]);
      setCreateOpen(false);
    }
  }

  async function update(id: string, patch: Partial<InventoryItem>) {
    if (controlled) {
      controlled.onUpdate(id, patch);
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
    if (!error) {
      setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setEditing(null);
    }
  }

  async function adjust(id: string, delta: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    await update(id, { quantity: Math.max(0, row.quantity + delta) });
  }

  async function remove(id: string) {
    if (controlled) {
      controlled.onRemove(id);
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (!error) {
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
      setEditing(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">{label}</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📦" title={`Aucun élément dans « ${label} »`} description="Ajoutez votre premier article." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Article</Th>
                  {suppliers.length > 0 && <Th>Fournisseur</Th>}
                  <Th className="text-right">Quantité</Th>
                  <Th className="text-right">Ajuster</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((r) => {
                  const low = r.low_stock_threshold != null && r.quantity <= r.low_stock_threshold;
                  return (
                    <Tr key={r.id} onClick={() => setEditing(r)}>
                      <Td className="font-semibold text-ink">
                        {r.name} {low && <Badge tone="danger" className="ml-1.5">Stock bas</Badge>}
                      </Td>
                      {suppliers.length > 0 && <Td className="text-muted">{supplierName(r.supplier_id)}</Td>}
                      <Td className="text-right font-display font-bold">
                        {r.quantity} {r.unit}
                      </Td>
                      <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={() => adjust(r.id, -1)} className="h-6 w-6 rounded-md border border-line bg-panel">
                            −
                          </button>
                          <button onClick={() => adjust(r.id, 1)} className="h-6 w-6 rounded-md border border-line bg-panel">
                            +
                          </button>
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

      <ItemDrawer open={createOpen} title={`Ajouter — ${label}`} initial={null} suppliers={suppliers} onClose={() => setCreateOpen(false)} onSubmit={create} />
      {editing && (
        <ItemDrawer
          open
          title={editing.name}
          initial={editing}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            update(editing.id, {
              name: input.name.trim(),
              quantity: Number(input.quantity) || 0,
              unit: input.unit.trim() || "unité",
              low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null,
              unit_cost: Number(input.unitCost) || 0,
              supplier_id: input.supplierId || null,
            })
          }
          onDelete={() => remove(editing.id)}
        />
      )}
    </Card>
  );
}

function ItemDrawer({
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
  initial: InventoryItem | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSubmit: (input: ItemInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "0");
  const [unit, setUnit] = useState(initial?.unit ?? "unité");
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.low_stock_threshold != null ? String(initial.low_stock_threshold) : "");
  const [unitCost, setUnitCost] = useState(initial ? String(initial.unit_cost) : "0");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");

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
            Quantité
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Unité
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Seuil de stock bas
            <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Coût unitaire (€)
            <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </label>
          {suppliers.length > 0 && (
            <label className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold text-muted">
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
          )}
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={() => onSubmit({ name, quantity, unit, lowStockThreshold, unitCost, supplierId })} disabled={!name.trim()}>
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
