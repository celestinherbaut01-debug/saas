"use client";

import { useState } from "react";
import type { Customer } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { normalizeSearch } from "@/lib/utils";

interface ControlledCustomers {
  rows: Customer[];
  onCreate: (input: { name: string; phone: string; email: string; notes: string }) => void;
  onUpdate: (id: string, patch: Partial<Customer>) => void;
  /** `mode` "archive" masque le client des listes actives sans rien supprimer (préféré s'il a des données liées — véhicules, ordres, projets...) ; "delete" le supprime définitivement. */
  onRemove: (id: string, mode: "archive" | "delete") => void;
}

// Composant partagé entre toutes les verticales (garage/nettoyage/agence/
// restaurant/générique) — seul le libellé change (Clients/Sites…), la
// table et le workflow restent identiques.
//
// Deux modes : non-contrôlé (état local + appels Supabase directs — usage
// historique, simple) ou contrôlé via `controlled` (état possédé par un
// parent, ex. GarageView, qui doit voir les clients à jour dans plusieurs
// onglets à la fois — sans ça, un client ajouté ici resterait invisible
// dans le sélecteur "véhicule/ordre de réparation" tant que la page n'est
// pas rechargée).
export function CustomersModule({
  workspaceId,
  initial,
  label,
  controlled,
}: {
  workspaceId: string;
  initial: Customer[];
  label: string;
  controlled?: ControlledCustomers;
}) {
  const supabase = createClient();
  const [localRows, setLocalRows] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");

  const rows = controlled ? controlled.rows : localRows;
  const filteredRows = search.trim()
    ? rows.filter((r) => normalizeSearch(`${r.name} ${r.phone ?? ""} ${r.email ?? ""}`).includes(normalizeSearch(search.trim())))
    : rows;

  async function create(input: { name: string; phone: string; email: string; notes: string }) {
    if (!input.name.trim()) return;
    if (controlled) {
      controlled.onCreate(input);
      setCreateOpen(false);
      return;
    }
    const { data, error } = await supabase
      .from("customers")
      .insert({
        workspace_id: workspaceId,
        name: input.name.trim(),
        phone: input.phone.trim() || null,
        email: input.email.trim() || null,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if (!error && data) {
      setLocalRows((prev) => [data, ...prev]);
      setCreateOpen(false);
    }
  }

  async function update(id: string, patch: Partial<Customer>) {
    if (controlled) {
      controlled.onUpdate(id, patch);
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("customers").update(patch).eq("id", id);
    if (!error) {
      setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setEditing(null);
    }
  }

  async function remove(id: string, mode: "archive" | "delete") {
    if (controlled) {
      controlled.onRemove(id, mode);
      setEditing(null);
      return;
    }
    const { error } =
      mode === "archive"
        ? await supabase.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("customers").delete().eq("id", id);
    if (!error) {
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
      setEditing(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">
          {label} <span className="font-normal text-faint">({rows.length})</span>
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="◈"
            title={`Aucun élément dans « ${label} »`}
            description="Ajoutez votre premier enregistrement pour commencer."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Ajouter
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          {rows.length > 5 && (
            <Input
              placeholder="Rechercher (nom, téléphone, email)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2.5"
            />
          )}
          {filteredRows.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-muted">Aucun résultat pour « {search} ».</p>
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

      <CustomerDrawer
        open={createOpen}
        title={`Ajouter — ${label}`}
        initial={null}
        onClose={() => setCreateOpen(false)}
        onSubmit={create}
      />
      {editing && (
        <CustomerDrawer
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

function CustomerDrawer({
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
  initial: Customer | null;
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
        {onDelete && <ConfirmDeleteButton itemLabel={`le client « ${initial?.name ?? ""} »`} onArchive={onArchive} onConfirm={onDelete} />}
      </div>
    </Drawer>
  );
}
