"use client";

import { useState } from "react";
import type { ClientSite, Customer, Project } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS_LABEL, formatEUR } from "@/lib/agency";

interface SiteInput {
  domainName: string;
  hostingProvider: string;
  customerId: string;
  projectId: string;
  domainRenewalDate: string;
  hostingRenewalDate: string;
  nextMaintenanceAt: string;
  monthlyPrice: string;
  notes: string;
}

// "Sites" + "Domaines" + "Hébergements" + "Renouvellements" + "Maintenance"
// consolidés en un seul module réel : ce sont les 5 facettes du même objet
// (un site web géré pour un client), pas 5 entités indépendantes.
export function SitesModule({
  rows,
  customers,
  projects,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: ClientSite[];
  customers: Customer[];
  projects: Project[];
  onCreate: (input: SiteInput) => void;
  onUpdate: (id: string, patch: Partial<ClientSite>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClientSite | null>(null);

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
      <p className="mt-1 text-[11.5px] text-muted">Domaine, hébergement, renouvellements et maintenance d&apos;un même site — vus ensemble.</p>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🌐" title="Aucun site" description="Ajoutez un site pour suivre son domaine, son hébergement et ses échéances." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Domaine</Th>
                  <Th>Client</Th>
                  <Th>Domaine expire</Th>
                  <Th>Hébergement expire</Th>
                  <Th className="text-right">€ / mois</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((s) => (
                  <Tr key={s.id} onClick={() => setEditing(s)}>
                    <Td className="font-semibold text-ink">{s.domain_name || "—"}</Td>
                    <Td className="text-muted">{customerName(s.customer_id)}</Td>
                    <Td className="text-muted">{s.domain_renewal_date ? new Date(s.domain_renewal_date).toLocaleDateString("fr-FR") : "—"}</Td>
                    <Td className="text-muted">{s.hosting_renewal_date ? new Date(s.hosting_renewal_date).toLocaleDateString("fr-FR") : "—"}</Td>
                    <Td className="text-right font-semibold">{formatEUR(s.monthly_price)}</Td>
                    <Td>
                      <Badge tone={SITE_STATUS_LABEL[s.status].tone}>{SITE_STATUS_LABEL[s.status].text}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <SiteDrawer open={createOpen} title="Ajouter un site" initial={null} customers={customers} projects={projects} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <SiteDrawer
          open
          title={editing.domain_name || "Site"}
          initial={editing}
          customers={customers}
          projects={projects}
          onClose={() => setEditing(null)}
          onStatusChange={(status) => onUpdate(editing.id, { status })}
          onSubmit={(input) => {
            onUpdate(editing.id, {
              domain_name: input.domainName.trim(),
              hosting_provider: input.hostingProvider.trim(),
              customer_id: input.customerId || null,
              project_id: input.projectId || null,
              domain_renewal_date: input.domainRenewalDate || null,
              hosting_renewal_date: input.hostingRenewalDate || null,
              next_maintenance_at: input.nextMaintenanceAt || null,
              monthly_price: Number(input.monthlyPrice) || 0,
              notes: input.notes.trim(),
            });
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
  projects,
  onClose,
  onSubmit,
  onStatusChange,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: ClientSite | null;
  customers: Customer[];
  projects: Project[];
  onClose: () => void;
  onSubmit: (input: SiteInput) => void;
  onStatusChange?: (status: ClientSite["status"]) => void;
  onDelete?: () => void;
}) {
  const [domainName, setDomainName] = useState(initial?.domain_name ?? "");
  const [hostingProvider, setHostingProvider] = useState(initial?.hosting_provider ?? "");
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [domainRenewalDate, setDomainRenewalDate] = useState(initial?.domain_renewal_date ?? "");
  const [hostingRenewalDate, setHostingRenewalDate] = useState(initial?.hosting_renewal_date ?? "");
  const [nextMaintenanceAt, setNextMaintenanceAt] = useState(initial?.next_maintenance_at ?? "");
  const [monthlyPrice, setMonthlyPrice] = useState(initial ? String(initial.monthly_price) : "0");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={title} width="lg">
      <div className="flex flex-col gap-3">
        {onStatusChange && initial && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SITE_STATUS_LABEL) as ClientSite["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={s === initial.status ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg" : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"}
              >
                {SITE_STATUS_LABEL[s].text}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Nom de domaine
            <Input value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="exemple.fr" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Hébergeur
            <Input value={hostingProvider} onChange={(e) => setHostingProvider(e.target.value)} />
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
            Projet lié
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Domaine expire le
            <Input type="date" value={domainRenewalDate ?? ""} onChange={(e) => setDomainRenewalDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Hébergement expire le
            <Input type="date" value={hostingRenewalDate ?? ""} onChange={(e) => setHostingRenewalDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Prochaine maintenance
            <Input type="date" value={nextMaintenanceAt ?? ""} onChange={(e) => setNextMaintenanceAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Prix récurrent / mois (€)
            <Input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={() => onSubmit({ domainName, hostingProvider, customerId, projectId, domainRenewalDate, hostingRenewalDate, nextMaintenanceAt, monthlyPrice, notes })}>
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
