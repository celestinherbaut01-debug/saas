"use client";

import { useState } from "react";
import type { Incident, Site } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { INCIDENT_SEVERITY_LABEL } from "@/lib/cleaning";

interface IncidentInput {
  title: string;
  siteId: string;
  severity: Incident["severity"];
  notes: string;
}

export function IncidentsModule({
  rows,
  sites,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: Incident[];
  sites: Site[];
  onCreate: (input: IncidentInput) => void;
  onUpdate: (id: string, patch: Partial<Incident>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);

  function siteName(id: string | null) {
    return id ? sites.find((s) => s.id === id)?.name ?? "—" : "—";
  }

  const sorted = [...rows].sort((a, b) => b.reported_at.localeCompare(a.reported_at));

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Incidents</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Signaler
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="⚠" title="Aucun incident" description="Signalez un incident rencontré sur un site." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Signaler</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Incident</Th>
                  <Th>Site</Th>
                  <Th>Gravité</Th>
                  <Th>Signalé le</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((inc) => (
                  <Tr key={inc.id} onClick={() => setEditing(inc)}>
                    <Td className="font-semibold text-ink">{inc.title}</Td>
                    <Td className="text-muted">{siteName(inc.site_id)}</Td>
                    <Td>
                      <Badge tone={INCIDENT_SEVERITY_LABEL[inc.severity].tone}>{INCIDENT_SEVERITY_LABEL[inc.severity].text}</Badge>
                    </Td>
                    <Td className="text-muted">{new Date(inc.reported_at).toLocaleDateString("fr-FR")}</Td>
                    <Td>
                      <Badge tone={inc.status === "open" ? "warning" : "success"}>{inc.status === "open" ? "Ouvert" : "Résolu"}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <IncidentDrawer open={createOpen} title="Signaler un incident" initial={null} sites={sites} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <IncidentDrawer
          open
          title={editing.title}
          initial={editing}
          sites={sites}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, { title: input.title.trim(), site_id: input.siteId || null, severity: input.severity, notes: input.notes.trim() });
            setEditing(null);
          }}
          onToggleResolved={() => {
            onUpdate(editing.id, { status: editing.status === "open" ? "resolved" : "open", resolved_at: editing.status === "open" ? new Date().toISOString() : null });
            setEditing(null);
          }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function IncidentDrawer({
  open,
  title,
  initial,
  sites,
  onClose,
  onSubmit,
  onToggleResolved,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: Incident | null;
  sites: Site[];
  onClose: () => void;
  onSubmit: (input: IncidentInput) => void;
  onToggleResolved?: () => void;
  onDelete?: () => void;
}) {
  const [incTitle, setIncTitle] = useState(initial?.title ?? "");
  const [siteId, setSiteId] = useState(initial?.site_id ?? "");
  const [severity, setSeverity] = useState<Incident["severity"]>(initial?.severity ?? "medium");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Titre
          <Input value={incTitle} onChange={(e) => setIncTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Site
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">—</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Gravité
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Incident["severity"])}>
            <option value="low">Mineur</option>
            <option value="medium">Moyen</option>
            <option value="high">Grave</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Description
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => onSubmit({ title: incTitle, siteId, severity, notes })} disabled={!incTitle.trim()}>
          Enregistrer
        </Button>
        <div className="flex gap-2">
          {onToggleResolved && (
            <Button variant="outline" className="flex-1" onClick={onToggleResolved}>
              {initial?.status === "open" ? "Marquer résolu" : "Rouvrir"}
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
