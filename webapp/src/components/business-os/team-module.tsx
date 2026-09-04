"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Équipe générique (Employés/Équipe selon le libellé) — réutilisé par
// Nettoyage, Agence, Restaurant. Le Garage a sa propre version
// (garage-technicians.tsx) avec une charge de travail spécifique aux
// ordres de réparation ; `workloadOf` ici permet la même idée pour
// n'importe quelle verticale sans dupliquer le composant.
export function TeamModule({
  label,
  rows,
  workloadOf,
  onCreate,
  onUpdate,
  onRemove,
}: {
  label: string;
  rows: TeamMember[];
  workloadOf?: (memberId: string) => string;
  onCreate: (input: { name: string; role: string; phone: string; email: string }) => void;
  onUpdate: (id: string, patch: Partial<TeamMember>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

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
          <EmptyState icon="🧑‍💼" title={`Aucun membre dans « ${label} »`} description="Ajoutez votre équipe." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Rôle</Th>
                  <Th>Statut</Th>
                  {workloadOf && <Th className="text-right">Charge</Th>}
                </tr>
              </Thead>
              <tbody>
                {rows.map((t) => (
                  <Tr key={t.id} onClick={() => setEditing(t)}>
                    <Td className="font-semibold text-ink">{t.name}</Td>
                    <Td className="text-muted">{t.role || "—"}</Td>
                    <Td>
                      <Badge tone={t.active ? "success" : "neutral"}>{t.active ? "Actif" : "Inactif"}</Badge>
                    </Td>
                    {workloadOf && <Td className="text-right text-muted">{workloadOf(t.id)}</Td>}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <TeamMemberDrawer open={createOpen} title="Ajouter" initial={null} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <TeamMemberDrawer
          open
          title={editing.name}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, { name: input.name.trim(), role: input.role.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null });
            setEditing(null);
          }}
          onToggleActive={() => { onUpdate(editing.id, { active: !editing.active }); setEditing(null); }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function TeamMemberDrawer({
  open,
  title,
  initial,
  onClose,
  onSubmit,
  onToggleActive,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: TeamMember | null;
  onClose: () => void;
  onSubmit: (input: { name: string; role: string; phone: string; email: string }) => void;
  onToggleActive?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Nom
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Rôle
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Téléphone
          <Input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Email
          <Input value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => onSubmit({ name, role, phone: phone ?? "", email: email ?? "" })} disabled={!name.trim()}>
          Enregistrer
        </Button>
        <div className="flex gap-2">
          {onToggleActive && (
            <Button variant="outline" className="flex-1" onClick={onToggleActive}>
              {initial?.active ? "Marquer inactif" : "Marquer actif"}
            </Button>
          )}
          {onDelete && (
            <Button variant="outline" onClick={onDelete}>
              Supprimer
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
