"use client";

import { useState } from "react";
import type { Intervention, Contract, Site, TeamMember } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { INTERVENTION_STATUS_LABEL } from "@/lib/cleaning";

interface InterventionInput {
  contractId: string;
  siteId: string;
  teamMemberId: string;
  scheduledAt: string;
}

export function InterventionsModule({
  rows,
  contracts,
  sites,
  teamMembers,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: Intervention[];
  contracts: Contract[];
  sites: Site[];
  teamMembers: TeamMember[];
  onCreate: (input: InterventionInput) => void;
  onUpdate: (id: string, patch: Partial<Intervention>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Intervention | null>(null);

  function siteName(id: string | null) {
    return id ? sites.find((s) => s.id === id)?.name ?? "—" : "—";
  }
  function contractLabel(id: string | null) {
    return id ? contracts.find((c) => c.id === id)?.site_name ?? "—" : "—";
  }
  function teamMemberName(id: string | null) {
    return id ? teamMembers.find((t) => t.id === id)?.name ?? "—" : "—";
  }

  const sorted = [...rows].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Interventions</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Planifier
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🧹" title="Aucune intervention" description="Planifiez une intervention sur un site." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Planifier</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Site</Th>
                  <Th>Équipe</Th>
                  <Th>Statut</Th>
                  <Th>Qualité</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((it) => (
                  <Tr key={it.id} onClick={() => setEditing(it)}>
                    <Td className="text-muted">{new Date(it.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td className="font-semibold text-ink">{it.site_id ? siteName(it.site_id) : contractLabel(it.contract_id)}</Td>
                    <Td className="text-muted">{teamMemberName(it.team_member_id)}</Td>
                    <Td>
                      <Badge tone={INTERVENTION_STATUS_LABEL[it.status].tone}>{INTERVENTION_STATUS_LABEL[it.status].text}</Badge>
                    </Td>
                    <Td className="text-muted">{it.quality_rating ? "★".repeat(it.quality_rating) : "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <CreateDrawer open={createOpen} contracts={contracts} sites={sites} teamMembers={teamMembers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <DetailDrawer
          intervention={editing}
          teamMembers={teamMembers}
          siteName={siteName(editing.site_id) !== "—" ? siteName(editing.site_id) : contractLabel(editing.contract_id)}
          onClose={() => setEditing(null)}
          onPatch={(patch) => { onUpdate(editing.id, patch); setEditing((e) => (e ? { ...e, ...patch } : e)); }}
          onRemove={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function CreateDrawer({
  open,
  contracts,
  sites,
  teamMembers,
  onClose,
  onSubmit,
}: {
  open: boolean;
  contracts: Contract[];
  sites: Site[];
  teamMembers: TeamMember[];
  onClose: () => void;
  onSubmit: (input: InterventionInput) => void;
}) {
  const [contractId, setContractId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [teamMemberId, setTeamMemberId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  if (!open) return null;

  function submit() {
    if (!scheduledAt) return;
    onSubmit({ contractId, siteId, teamMemberId, scheduledAt });
    setContractId("");
    setSiteId("");
    setTeamMemberId("");
    setScheduledAt("");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Planifier une intervention">
      <div className="flex flex-col gap-3">
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
          Contrat lié (optionnel)
          <Select value={contractId} onChange={(e) => setContractId(e.target.value)}>
            <option value="">—</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.site_name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Équipe / employé
          <Select value={teamMemberId} onChange={(e) => setTeamMemberId(e.target.value)}>
            <option value="">Non assigné</option>
            {teamMembers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Date et heure
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </label>
      </div>
      <div className="mt-5">
        <Button className="w-full" onClick={submit} disabled={!scheduledAt}>
          Planifier
        </Button>
      </div>
    </Drawer>
  );
}

function DetailDrawer({
  intervention,
  teamMembers,
  siteName,
  onClose,
  onPatch,
  onRemove,
}: {
  intervention: Intervention;
  teamMembers: TeamMember[];
  siteName: string;
  onClose: () => void;
  onPatch: (patch: Partial<Intervention>) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(intervention.notes);

  return (
    <Drawer open onClose={onClose} title={siteName} subtitle={new Date(intervention.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          {(["planned", "done", "missed"] as Intervention["status"][]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPatch({ status: s, completed_at: s === "done" ? new Date().toISOString() : intervention.completed_at })}
              className={s === intervention.status ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg" : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"}
            >
              {INTERVENTION_STATUS_LABEL[s].text}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Équipe / employé
          <Select value={intervention.team_member_id ?? ""} onChange={(e) => onPatch({ team_member_id: e.target.value || null })}>
            <option value="">Non assigné</option>
            {teamMembers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>

        {intervention.status === "done" && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Note qualité</p>
            <div className="mt-1.5 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onPatch({ quality_rating: n })}
                  className={n <= (intervention.quality_rating ?? 0) ? "text-lg text-amber-fg" : "text-lg text-line"}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onPatch({ notes })} />
        </label>

        <button type="button" onClick={onRemove} className="self-start text-[11.5px] font-semibold text-faint hover:text-red-fg">
          Supprimer cette intervention
        </button>
      </div>
    </Drawer>
  );
}
