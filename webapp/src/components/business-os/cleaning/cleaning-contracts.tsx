"use client";

import { useState } from "react";
import type { Contract, Customer, Site } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUS_LABEL } from "@/lib/cleaning";
import { formatEUR } from "@/lib/format";

interface ContractInput {
  siteId: string;
  siteName: string;
  customerId: string;
  frequency: string;
  monthlyPrice: string;
  renewalDate: string;
  notes: string;
}

export function ContractsModule({
  rows,
  sites,
  customers,
  onCreate,
  onUpdate,
  onRemove,
  onCreateInvoice,
}: {
  rows: Contract[];
  sites: Site[];
  customers: Customer[];
  onCreate: (input: ContractInput) => void;
  onUpdate: (id: string, patch: Partial<Contract>) => void;
  onRemove: (id: string) => void;
  onCreateInvoice?: (contract: Contract) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);

  function siteName(c: Contract) {
    if (c.site_id) return sites.find((s) => s.id === c.site_id)?.name ?? c.site_name;
    return c.site_name || "—";
  }
  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Contrats</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📋" title="Aucun contrat" description="Créez un contrat pour un site, avec sa fréquence et son prix mensuel." action={<Button size="sm" onClick={() => setCreateOpen(true)}>+ Ajouter</Button>} />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Site</Th>
                  <Th>Client</Th>
                  <Th>Fréquence</Th>
                  <Th className="text-right">Prix / mois</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((c) => (
                  <Tr key={c.id} onClick={() => setEditing(c)}>
                    <Td className="font-semibold text-ink">{siteName(c)}</Td>
                    <Td className="text-muted">{customerName(c.customer_id)}</Td>
                    <Td className="text-muted">{c.frequency || "—"}</Td>
                    <Td className="text-right font-semibold">{formatEUR(c.monthly_price)}</Td>
                    <Td>
                      <Badge tone={CONTRACT_STATUS_LABEL[c.status].tone}>{CONTRACT_STATUS_LABEL[c.status].text}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <ContractDrawer open={createOpen} title="Ajouter un contrat" initial={null} sites={sites} customers={customers} onClose={() => setCreateOpen(false)} onSubmit={(input) => { onCreate(input); setCreateOpen(false); }} />
      {editing && (
        <ContractDrawer
          open
          title={siteName(editing)}
          initial={editing}
          sites={sites}
          customers={customers}
          onClose={() => setEditing(null)}
          onStatusChange={(status) => onUpdate(editing.id, { status })}
          onSubmit={(input) => {
            const site = sites.find((s) => s.id === input.siteId);
            onUpdate(editing.id, {
              site_id: input.siteId || null,
              site_name: site?.name ?? input.siteName.trim(),
              customer_id: input.customerId || null,
              frequency: input.frequency.trim(),
              monthly_price: Number(input.monthlyPrice) || 0,
              renewal_date: input.renewalDate || null,
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

function ContractDrawer({
  open,
  title,
  initial,
  sites,
  customers,
  onClose,
  onSubmit,
  onStatusChange,
  onDelete,
  onCreateInvoice,
}: {
  open: boolean;
  title: string;
  initial: Contract | null;
  sites: Site[];
  customers: Customer[];
  onClose: () => void;
  onSubmit: (input: ContractInput) => void;
  onStatusChange?: (status: Contract["status"]) => void;
  onDelete?: () => void;
  onCreateInvoice?: () => void;
}) {
  const [siteId, setSiteId] = useState(initial?.site_id ?? "");
  const [siteName, setSiteName] = useState(initial?.site_name ?? "");
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");
  const [monthlyPrice, setMonthlyPrice] = useState(initial ? String(initial.monthly_price) : "0");
  const [renewalDate, setRenewalDate] = useState(initial?.renewal_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  if (!open) return null;
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {onStatusChange && initial && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CONTRACT_STATUS_LABEL) as Contract["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={s === initial.status ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg" : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"}
              >
                {CONTRACT_STATUS_LABEL[s].text}
              </button>
            ))}
          </div>
        )}
        {sites.length > 0 ? (
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Site
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Choisir un site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Nom du site
            <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Ajoutez d'abord un site dans l'onglet Sites (optionnel)" />
          </label>
        )}
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
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Fréquence
            <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Ex. 2x/semaine" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Prix / mois (€)
            <Input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Date de renouvellement
            <Input type="date" value={renewalDate ?? ""} onChange={(e) => setRenewalDate(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => onSubmit({ siteId, siteName, customerId, frequency, monthlyPrice, renewalDate, notes })}>
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
