"use client";

import { useState } from "react";
import type { TeamMember, RepairOrder } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { REPAIR_STATUS_ACTIVE } from "@/lib/garage";

// Module dédié réservé au plan Max : gestion de l'équipe (rôle, actif/inactif)
// + charge de travail réelle (ordres actifs assignés) — au plan Pro,
// l'assignation d'un technicien reste possible via le sélecteur intégré à
// l'ordre de réparation, mais pas cette vue de gestion/charge d'équipe.
export function TechniciansModule({
  rows,
  repairOrders,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: TeamMember[];
  repairOrders: RepairOrder[];
  onCreate: (input: { name: string; role: string; phone: string; email: string }) => void;
  onUpdate: (id: string, patch: Partial<TeamMember>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  function activeOrdersOf(technicianId: string) {
    return repairOrders.filter((r) => r.technician_id === technicianId && REPAIR_STATUS_ACTIVE.includes(r.status));
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Techniciens</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🧑‍🔧" title="Aucun technicien" description="Ajoutez votre équipe pour assigner les ordres de réparation." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
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
                  <Th className="text-right">Charge actuelle</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((t) => {
                  const active = activeOrdersOf(t.id);
                  return (
                    <Tr key={t.id} onClick={() => setEditing(t)}>
                      <Td className="font-semibold text-ink">{t.name}</Td>
                      <Td className="text-muted">{t.role || "—"}</Td>
                      <Td>
                        <Badge tone={t.active ? "success" : "neutral"}>{t.active ? "Actif" : "Inactif"}</Badge>
                      </Td>
                      <Td className="text-right text-muted">{active.length} ordre(s) en cours</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <TechnicianDrawer open={createOpen} title="Ajouter un technicien" initial={null} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <TechnicianDrawer
          open
          title={editing.name}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, { name: input.name.trim(), role: input.role.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null });
            setEditing(null);
          }}
          onToggleActive={() => {
            onUpdate(editing.id, { active: !editing.active });
            setEditing(null);
          }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function TechnicianDrawer({
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
          Rôle / spécialité
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. Mécanique générale" />
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
