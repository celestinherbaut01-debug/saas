"use client";

import { useState } from "react";
import type { Site, Customer } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";

interface SiteInput {
  name: string;
  address: string;
  customerId: string;
  notes: string;
}

export function SitesModule({
  rows,
  customers,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: Site[];
  customers: Customer[];
  onCreate: (input: SiteInput) => void;
  onUpdate: (id: string, patch: Partial<Site>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Sites</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🏢" title="Aucun site" description="Ajoutez les sites que vous entretenez, puis liez-y un contrat." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Site</Th>
                  <Th>Adresse</Th>
                  <Th>Client</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((s) => (
                  <Tr key={s.id} onClick={() => setEditing(s)}>
                    <Td className="font-semibold text-ink">{s.name}</Td>
                    <Td className="text-muted">{s.address || "—"}</Td>
                    <Td className="text-muted">{customerName(s.customer_id)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <SiteDrawer open={createOpen} title="Ajouter un site" initial={null} customers={customers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <SiteDrawer
          open
          title={editing.name}
          initial={editing}
          customers={customers}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, { name: input.name.trim(), address: input.address.trim(), customer_id: input.customerId || null, notes: input.notes.trim() });
            setEditing(null);
          }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function SiteDrawer({
  open,
  title,
  initial,
  customers,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: Site | null;
  customers: Customer[];
  onClose: () => void;
  onSubmit: (input: SiteInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Nom du site
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Adresse
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Client
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={() => onSubmit({ name, address, customerId, notes })} disabled={!name.trim()}>
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
