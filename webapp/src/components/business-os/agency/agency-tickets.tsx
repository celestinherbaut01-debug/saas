"use client";

import { useState } from "react";
import type { Ticket, Customer, ClientSite } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TICKET_STATUS_LABEL, TICKET_PRIORITY_LABEL } from "@/lib/agency";

interface TicketInput {
  title: string;
  customerId: string;
  siteId: string;
  priority: Ticket["priority"];
  notes: string;
}

export function TicketsModule({
  rows,
  customers,
  sites,
  onCreate,
  onUpdate,
  onRemove,
}: {
  rows: Ticket[];
  customers: Customer[];
  sites: ClientSite[];
  onCreate: (input: TicketInput) => void;
  onUpdate: (id: string, patch: Partial<Ticket>) => void;
  onRemove: (id: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }
  function siteName(id: string | null) {
    return id ? sites.find((s) => s.id === id)?.domain_name ?? "—" : "—";
  }

  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Tickets</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ouvrir un ticket
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🎫" title="Aucun ticket" description="Ouvrez un ticket pour une demande support client." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ouvrir un ticket</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Client</Th>
                  <Th>Site</Th>
                  <Th>Priorité</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((t) => (
                  <Tr key={t.id} onClick={() => setEditing(t)}>
                    <Td className="font-semibold text-ink">{t.title}</Td>
                    <Td className="text-muted">{customerName(t.customer_id)}</Td>
                    <Td className="text-muted">{siteName(t.site_id)}</Td>
                    <Td>
                      <Badge tone={TICKET_PRIORITY_LABEL[t.priority].tone}>{TICKET_PRIORITY_LABEL[t.priority].text}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={TICKET_STATUS_LABEL[t.status].tone}>{TICKET_STATUS_LABEL[t.status].text}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <TicketDrawer open={createOpen} title="Ouvrir un ticket" initial={null} customers={customers} sites={sites} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <TicketDrawer
          open
          title={editing.title}
          initial={editing}
          customers={customers}
          sites={sites}
          onClose={() => setEditing(null)}
          onStatusChange={(status) => onUpdate(editing.id, { status, resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : editing.resolved_at })}
          onSubmit={(input) => {
            onUpdate(editing.id, { title: input.title.trim(), customer_id: input.customerId || null, site_id: input.siteId || null, priority: input.priority, notes: input.notes.trim() });
            setEditing(null);
          }}
          onDelete={() => { onRemove(editing.id); setEditing(null); }}
        />
      )}
    </Card>
  );
}

function TicketDrawer({
  open,
  title,
  initial,
  customers,
  sites,
  onClose,
  onSubmit,
  onStatusChange,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: Ticket | null;
  customers: Customer[];
  sites: ClientSite[];
  onClose: () => void;
  onSubmit: (input: TicketInput) => void;
  onStatusChange?: (status: Ticket["status"]) => void;
  onDelete?: () => void;
}) {
  const [ticketTitle, setTicketTitle] = useState(initial?.title ?? "");
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [siteId, setSiteId] = useState(initial?.site_id ?? "");
  const [priority, setPriority] = useState<Ticket["priority"]>(initial?.priority ?? "normal");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {onStatusChange && initial && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TICKET_STATUS_LABEL) as Ticket["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={s === initial.status ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg" : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"}
              >
                {TICKET_STATUS_LABEL[s].text}
              </button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Titre
          <Input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
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
            Site
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.domain_name || s.id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Priorité
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Ticket["priority"])}>
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </Select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Description
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button className="flex-1" onClick={() => onSubmit({ title: ticketTitle, customerId, siteId, priority, notes })} disabled={!ticketTitle.trim()}>
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
