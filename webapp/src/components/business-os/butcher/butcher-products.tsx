"use client";

import { useState } from "react";
import type { InventoryCategory, InventoryItem, Supplier } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { formatEUR } from "@/lib/butcher";
import { normalizeSearch } from "@/lib/utils";

const UNITS = ["kg", "g", "pièce", "barquette", "lot"];

interface ProductInput {
  name: string;
  categoryId: string;
  reference: string;
  unit: string;
  quantity: string;
  lowStockThreshold: string;
  unitCost: string;
  unitPrice: string;
  supplierId: string;
}

export function ProductsModule({
  initialFocusId,
  rows,
  categories,
  suppliers,
  onCreate,
  onUpdate,
  onRemove,
  onCreateCategory,
}: {
  initialFocusId?: string | null;
  rows: InventoryItem[];
  categories: InventoryCategory[];
  suppliers: Supplier[];
  onCreate: (input: ProductInput) => void;
  onUpdate: (id: string, patch: Partial<InventoryItem>) => void;
  onRemove: (id: string, mode: "archive" | "delete") => void;
  onCreateCategory: (name: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(rows.find((r) => r.id === initialFocusId) ?? null);
  const [search, setSearch] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const active = rows.filter((r) => !r.archived_at);
  const filtered = search.trim() ? active.filter((r) => normalizeSearch(`${r.name} ${r.reference}`).includes(normalizeSearch(search.trim()))) : active;

  function categoryName(id: string | null) {
    return id ? categories.find((c) => c.id === id)?.name ?? "—" : "—";
  }
  function supplierName(id: string | null) {
    return id ? suppliers.find((s) => s.id === id)?.name ?? "—" : "—";
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">
          Produits <span className="font-normal text-faint">({active.length})</span>
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter un produit
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input placeholder="+ Nouvelle catégorie" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-8 w-48 text-[12px]" />
        <Button
          size="sm"
          variant="outline"
          disabled={!newCategory.trim()}
          onClick={() => {
            onCreateCategory(newCategory.trim());
            setNewCategory("");
          }}
        >
          Ajouter la catégorie
        </Button>
        {categories.length > 0 && <span className="text-[11px] text-faint">{categories.map((c) => c.name).join(" · ")}</span>}
      </div>

      {active.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🥩" title="Aucun produit" description="Ajoutez vos premiers produits (nom, unité, stock, prix)." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter un produit</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          {active.length > 5 && <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2.5" />}
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Produit</Th>
                  <Th>Catégorie</Th>
                  <Th className="text-right">Stock</Th>
                  <Th className="text-right">Prix de vente</Th>
                  <Th>Fournisseur</Th>
                </tr>
              </Thead>
              <tbody>
                {filtered.map((r) => {
                  const low = r.low_stock_threshold != null && r.quantity <= r.low_stock_threshold;
                  return (
                    <Tr key={r.id} onClick={() => setEditing(r)} className={initialFocusId === r.id ? "outline outline-2 outline-accent bg-accent/10" : undefined}>
                      <Td className="font-semibold text-ink">
                        {r.name}
                        {r.reference && <span className="ml-1.5 text-faint">({r.reference})</span>}
                      </Td>
                      <Td className="text-muted">{categoryName(r.category_id)}</Td>
                      <Td className="text-right">
                        {r.quantity} {r.unit} {low && <Badge tone="danger" className="ml-1.5">Stock bas</Badge>}
                      </Td>
                      <Td className="text-right text-muted">{r.unit_price != null ? formatEUR(r.unit_price) : "—"}</Td>
                      <Td className="text-muted">{supplierName(r.supplier_id)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <ProductDrawer open={createOpen} title="Ajouter un produit" initial={null} categories={categories} suppliers={suppliers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <ProductDrawer
          open
          title={editing.name}
          initial={editing}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, {
              name: input.name.trim(),
              category_id: input.categoryId || null,
              reference: input.reference.trim(),
              unit: input.unit,
              low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null,
              unit_cost: input.unitCost ? Number(input.unitCost) : 0,
              unit_price: input.unitPrice ? Number(input.unitPrice) : null,
              supplier_id: input.supplierId || null,
            });
            setEditing(null);
          }}
          onArchive={() => { onRemove(editing.id, "archive"); setEditing(null); }}
          onDelete={() => { onRemove(editing.id, "delete"); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function ProductDrawer({
  open,
  title,
  initial,
  categories,
  suppliers,
  onClose,
  onSubmit,
  onArchive,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: InventoryItem | null;
  categories: InventoryCategory[];
  suppliers: Supplier[];
  onClose: () => void;
  onSubmit: (input: ProductInput) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "kg");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "0");
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.low_stock_threshold != null ? String(initial.low_stock_threshold) : "");
  const [unitCost, setUnitCost] = useState(initial ? String(initial.unit_cost) : "");
  const [unitPrice, setUnitPrice] = useState(initial?.unit_price != null ? String(initial.unit_price) : "");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Nom du produit
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Entrecôte de bœuf" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Catégorie
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Référence (optionnel)
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Unité
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </label>
          {!initial ? (
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              Stock initial
              <Input type="number" min={0} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
          ) : (
            <div className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              Stock actuel
              <p className="mt-1 text-[13px] font-bold text-ink">
                {initial.quantity} {initial.unit}
              </p>
              <p className="text-[10.5px] font-normal text-faint">Modifiable depuis Mouvements ou Réceptions.</p>
            </div>
          )}
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Seuil de stock bas (optionnel)
            <Input type="number" min={0} step="0.01" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Fournisseur (optionnel)
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
            Coût d&apos;achat HT (optionnel)
            <Input type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Prix de vente (optionnel)
            <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => onSubmit({ name, categoryId, reference, unit, quantity, lowStockThreshold, unitCost, unitPrice, supplierId })} disabled={!name.trim()}>
          Enregistrer
        </Button>
        {onDelete && <ConfirmDeleteButton itemLabel={`le produit « ${initial?.name ?? "" }»`} onArchive={onArchive} onConfirm={onDelete} />}
      </div>
    </Drawer>
  );
}
