"use client";

import { useState } from "react";
import type { Supplier } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { normalizeSearch } from "@/lib/utils";

// Contrôlé par GarageView (comme Pièces/Techniciens) : la liste des
// fournisseurs doit être à jour pour le sélecteur de fournisseur de
// l'onglet Pièces. Réutilisable tel quel par Restaurant plus tard.
export function SuppliersModule({
  rows,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: Supplier[];
  onCreate: (input: { name: string; phone: string; email: string; notes: string }) => void;
  onUpdate: (id: string, patch: Partial<Supplier>) => void;
  onRemove: (id: string, mode: "archive" | "delete") => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const filteredRows = search.trim()
    ? rows.filter((r) => normalizeSearch(`${r.name} ${r.phone ?? ""} ${r.email ?? ""}`).includes(normalizeSearch(search.trim())))
    : rows;

  function create(input: { name: string; phone: string; email: string; notes: string }) {
    if (!input.name.trim()) return;
    onCreate(input);
    setCreateOpen(false);
  }

  function update(id: string, patch: Partial<Supplier>) {
    onUpdate(id, patch);
    setEditing(null);
  }

  function remove(id: string, mode: "archive" | "delete") {
    onRemove(id, mode);
    setEditing(null);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">
          Fournisseurs <span className="font-normal text-faint">({rows.length})</span>
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🚚" title="Aucun fournisseur" description="Ajoutez vos fournisseurs pour les lier à vos pièces." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          {rows.length > 5 && (
            <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2.5" />
          )}
          {filteredRows.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-muted">Aucun résultat.</p>
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <Th>Nom</Th>
                    <Th>Téléphone</Th>
                    <Th>Email</Th>
                  </tr>
                </Thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <Tr key={r.id} onClick={() => setEditing(r)}>
                      <Td className="font-semibold text-ink">{r.name}</Td>
                      <Td className="text-muted">{r.phone ?? "—"}</Td>
                      <Td className="text-muted">{r.email ?? "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </div>
      )}

      <SupplierDrawer open={createOpen} title="Ajouter un fournisseur" initial={null} onClose={() => setCreateOpen(false)} onSubmit={create} />
      {editing && (
        <SupplierDrawer
          open
          title={editing.name}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) => update(editing.id, { name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() })}
          onArchive={() => remove(editing.id, "archive")}
          onDelete={() => remove(editing.id, "delete")}
        />
      )}
    </Card>
  );
}

function SupplierDrawer({
  open,
  title,
  initial,
  onClose,
  onSubmit,
  onArchive,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: Supplier | null;
  onClose: () => void;
  onSubmit: (input: { name: string; phone: string; email: string; notes: string }) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Nom
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Téléphone
          <Input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Email
          <Input value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={() => onSubmit({ name, phone: phone ?? "", email: email ?? "", notes })} disabled={!name.trim()}>
          Enregistrer
        </Button>
        {onDelete && <ConfirmDeleteButton itemLabel={`le fournisseur « ${initial?.name ?? ""} »`} onArchive={onArchive} onConfirm={onDelete} />}
      </div>
    </Drawer>
  );
}
