"use client";

import { useState } from "react";
import type { Project, Customer } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABEL } from "@/lib/agency";

interface ProjectInput {
  name: string;
  projectType: Project["project_type"];
  customerId: string;
  deadline: string;
  budget: string;
  notes: string;
}

export function ProjectsModule({
  rows,
  customers,
  onCreate,
  onUpdate,
  onRemove,
  onCreateInvoice,
}: {
  rows: Project[];
  customers: Customer[];
  onCreate: (input: ProjectInput) => void;
  onUpdate: (id: string, patch: Partial<Project>) => void;
  onRemove: (id: string) => void;
  onCreateInvoice?: (project: Project) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  const now = new Date().getTime();

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Projets</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="💻" title="Aucun projet" description="Créez un projet pour un client (site, maintenance, autre)." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Projet</Th>
                  <Th>Client</Th>
                  <Th>Échéance</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((p) => {
                  const overdue = p.deadline && new Date(p.deadline).getTime() < now && p.status !== "done";
                  return (
                    <Tr key={p.id} onClick={() => setEditing(p)}>
                      <Td className="font-semibold text-ink">{p.name}</Td>
                      <Td className="text-muted">{customerName(p.customer_id)}</Td>
                      <Td className="text-muted">
                        {p.deadline ? new Date(p.deadline).toLocaleDateString("fr-FR") : "—"}
                        {overdue && <Badge tone="danger" className="ml-1.5">Retard</Badge>}
                      </Td>
                      <Td>
                        <Badge tone={PROJECT_STATUS_LABEL[p.status].tone}>{PROJECT_STATUS_LABEL[p.status].text}</Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <ProjectDrawer open={createOpen} title="Ajouter un projet" initial={null} customers={customers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <ProjectDrawer
          open
          title={editing.name}
          initial={editing}
          customers={customers}
          onClose={() => setEditing(null)}
          onStatusChange={(status) => onUpdate(editing.id, { status })}
          onSubmit={(input) => {
            onUpdate(editing.id, {
              name: input.name.trim(),
              project_type: input.projectType,
              customer_id: input.customerId || null,
              deadline: input.deadline || null,
              budget: input.budget ? Number(input.budget) : null,
              notes: input.notes.trim(),
            });
            setEditing(null);
          }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
          onCreateInvoice={onCreateInvoice ? () => onCreateInvoice(editing) : undefined}
        />
      )}
    </Card>
  );
}

function ProjectDrawer({
  open,
  title,
  initial,
  customers,
  onClose,
  onSubmit,
  onStatusChange,
  onDelete,
  onCreateInvoice,
}: {
  open: boolean;
  title: string;
  initial: Project | null;
  customers: Customer[];
  onClose: () => void;
  onSubmit: (input: ProjectInput) => void;
  onStatusChange?: (status: Project["status"]) => void;
  onDelete?: () => void;
  onCreateInvoice?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [projectType, setProjectType] = useState<Project["project_type"]>(initial?.project_type ?? "site");
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {onStatusChange && initial && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PROJECT_STATUS_LABEL) as Project["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={s === initial.status ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg" : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"}
              >
                {PROJECT_STATUS_LABEL[s].text}
              </button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Nom du projet
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Type
            <Select value={projectType} onChange={(e) => setProjectType(e.target.value as Project["project_type"])}>
              <option value="site">Site web</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Autre</option>
            </Select>
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
            Échéance
            <Input type="date" value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Budget (€)
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => onSubmit({ name, projectType, customerId, deadline, budget, notes })} disabled={!name.trim()}>
          Enregistrer
        </Button>
        <div className="flex gap-2">
        {onCreateInvoice && (
          <Button variant="outline" className="flex-1" onClick={onCreateInvoice}>
            + Créer une facture
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
