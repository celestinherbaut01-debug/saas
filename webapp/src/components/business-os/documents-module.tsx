"use client";

import { Fragment, useState } from "react";
import type { BusinessDocument, Customer, DocumentItem } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { DOC_STATUS_LABEL } from "@/lib/garage";
import { formatEUR } from "@/lib/format";
import { computeDocumentTotals, type DocumentLineInput } from "@/lib/document-totals";

const VAT_RATES = [0, 5.5, 10, 20];

export interface DocumentCreateInput {
  customerId: string;
  linkedId: string;
  issuedAt: string;
  dueAt: string;
  notes: string;
  items: DocumentLineInput[];
}

// Partagé entre Garage (lié à un ordre de réparation), Nettoyage (lié à un
// contrat) et Agence (lié à un projet) — `resolveLinkedLabel` isole la
// seule chose qui change entre verticales : le nom de ce à quoi le
// devis/la facture est rattaché. Création MANUELLE ajoutée ici (plutôt
// qu'uniquement depuis un projet/ordre de réparation comme avant) — le
// lien reste possible mais devient optionnel.
export function DocumentsModule({
  initialFocusId,
  docType,
  rows,
  itemsByDocument,
  customers,
  resolveLinkedLabel,
  emptyHint,
  onSetStatus,
  onCreate,
  onDeleteDraft,
  onConvertToInvoice,
  linkLabel,
  linkOptions,
}: {
  initialFocusId?: string | null;
  docType: "quote" | "invoice";
  rows: BusinessDocument[];
  itemsByDocument: Record<string, DocumentItem[]>;
  customers: Customer[];
  resolveLinkedLabel: (doc: BusinessDocument) => string;
  emptyHint: string;
  onSetStatus: (doc: BusinessDocument, status: BusinessDocument["status"]) => void;
  onCreate: (input: DocumentCreateInput) => Promise<void> | void;
  onDeleteDraft?: (doc: BusinessDocument) => void;
  onConvertToInvoice?: (doc: BusinessDocument) => Promise<void> | void;
  linkLabel?: string;
  linkOptions?: { id: string; label: string }[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const label = docType === "quote" ? "Devis" : "Factures";
  const docs = rows.filter((d) => d.doc_type === docType).sort((a, b) => b.issued_at.localeCompare(a.issued_at));

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  const total = docs.filter((d) => d.status !== "canceled" && d.status !== "refused").reduce((s, d) => s + d.total_ttc, 0);

  async function convert(doc: BusinessDocument) {
    if (!onConvertToInvoice || convertingId) return;
    setConvertingId(doc.id);
    try {
      await onConvertToInvoice(doc);
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">{label}</h2>
        <div className="flex items-center gap-2">
          {docs.length > 0 && <span className="text-[12px] font-semibold text-muted">Total : {formatEUR(total)}</span>}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + Nouveau{docType === "invoice" ? "lle" : ""} {docType === "quote" ? "devis" : "facture"}
          </Button>
        </div>
      </div>
      <p className="mt-1 text-[11.5px] text-muted">{emptyHint}</p>

      {docs.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={docType === "quote" ? "📄" : "🧾"}
            title={`Aucun${docType === "quote" ? "" : "e"} ${label.toLowerCase()}`}
            description={emptyHint}
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Nouveau{docType === "invoice" ? "lle" : ""} {docType === "quote" ? "devis" : "facture"}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Numéro</Th>
                  <Th>Client</Th>
                  <Th>Lié à</Th>
                  <Th>Émis le</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Statut</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <tbody>
                {docs.map((d) => {
                  const items = itemsByDocument[d.id] ?? [];
                  const expanded = expandedId === d.id;
                  return (
                  <Fragment key={d.id}>
                  <Tr className={initialFocusId === d.id ? "outline outline-2 outline-accent bg-accent/10" : undefined}>
                    <Td className="font-semibold text-ink">
                      {items.length > 0 ? (
                        <button type="button" onClick={() => setExpandedId(expanded ? null : d.id)} className="flex items-center gap-1 hover:text-accent">
                          <span aria-hidden>{expanded ? "▾" : "▸"}</span> {d.number || "—"}
                        </button>
                      ) : (
                        d.number || "—"
                      )}
                    </Td>
                    <Td className="text-muted">{customerName(d.customer_id)}</Td>
                    <Td className="text-muted">{resolveLinkedLabel(d)}</Td>
                    <Td className="text-muted">{new Date(d.issued_at).toLocaleDateString("fr-FR")}</Td>
                    <Td className="text-right font-semibold">{formatEUR(d.total_ttc)}</Td>
                    <Td>
                      <Select
                        className="h-7 text-[11px]"
                        value={d.status}
                        onChange={(e) => onSetStatus(d, e.target.value as BusinessDocument["status"])}
                      >
                        {Object.entries(DOC_STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.text}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1.5">
                        {docType === "quote" && onConvertToInvoice && (
                          d.converted_to_document_id ? (
                            <span className="text-[10.5px] font-semibold text-green-fg">Convertie</span>
                          ) : d.status === "accepted" ? (
                            <Button size="sm" variant="outline" disabled={convertingId === d.id} onClick={() => convert(d)}>
                              {convertingId === d.id ? "Conversion…" : "Convertir en facture"}
                            </Button>
                          ) : null
                        )}
                        {d.status === "draft" && onDeleteDraft && (
                          <ConfirmDeleteButton itemLabel={`le brouillon ${d.number || "sans numéro"}`} onConfirm={() => onDeleteDraft(d)} size="sm" />
                        )}
                      </div>
                    </Td>
                  </Tr>
                  {expanded && items.length > 0 && (
                    <tr>
                      <td colSpan={7} className="bg-soft/60 px-4 py-2">
                        <ul className="flex flex-col gap-1 text-[11.5px]">
                          {items.map((it) => (
                            <li key={it.id} className="flex justify-between gap-3">
                              <span className="text-muted">
                                {it.description} — {it.quantity} × {formatEUR(it.unit_price_ht)} HT ({it.vat_rate}% TVA)
                              </span>
                              <span className="font-semibold">{formatEUR(it.quantity * it.unit_price_ht * (1 + it.vat_rate / 100))}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <DocumentCreateDrawer
        open={createOpen}
        docType={docType}
        customers={customers}
        linkLabel={linkLabel}
        linkOptions={linkOptions}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (input) => {
          await onCreate(input);
          setCreateOpen(false);
        }}
      />
    </Card>
  );
}

function emptyLine(): DocumentLineInput {
  return { description: "", quantity: 1, unitPriceHt: 0, vatRate: 20 };
}

function DocumentCreateDrawer({
  open,
  docType,
  customers,
  linkLabel,
  linkOptions,
  onClose,
  onSubmit,
}: {
  open: boolean;
  docType: "quote" | "invoice";
  customers: Customer[];
  linkLabel?: string;
  linkOptions?: { id: string; label: string }[];
  onClose: () => void;
  onSubmit: (input: DocumentCreateInput) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState("");
  const [linkedId, setLinkedId] = useState("");
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DocumentLineInput[]>([emptyLine()]);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const validLines = items.filter((l) => l.description.trim() && l.quantity > 0);
  const totals = computeDocumentTotals(validLines);
  const canSubmit = !pending && validLines.length > 0;

  function updateLine(i: number, patch: Partial<DocumentLineInput>) {
    setItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function reset() {
    setCustomerId("");
    setLinkedId("");
    setIssuedAt(new Date().toISOString().slice(0, 10));
    setDueAt("");
    setNotes("");
    setItems([emptyLine()]);
  }

  async function submit() {
    if (!canSubmit || pending) return;
    setPending(true);
    try {
      await onSubmit({ customerId, linkedId, issuedAt, dueAt, notes, items: validLines });
      reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={docType === "quote" ? "Nouveau devis" : "Nouvelle facture"} width="lg">
      <div className="flex flex-col gap-3">
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
          {linkOptions && (
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
              {linkLabel ?? "Lié à"} (optionnel)
              <Select value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
                <option value="">—</option>
                {linkOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Date d&apos;émission
            <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Date d&apos;échéance
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </label>
        </div>

        <div className="mt-1 flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Lignes</p>
          {items.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_90px_70px_auto] items-end gap-1.5 rounded-lg border border-line bg-soft p-2">
              <label className="flex flex-col gap-0.5 text-[10.5px] font-semibold text-muted">
                Description
                <Input className="h-8 text-[12.5px]" value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
              </label>
              <label className="flex flex-col gap-0.5 text-[10.5px] font-semibold text-muted">
                Qté
                <Input className="h-8 text-[12.5px]" type="number" min={0} step="0.01" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-0.5 text-[10.5px] font-semibold text-muted">
                Prix HT
                <Input className="h-8 text-[12.5px]" type="number" min={0} step="0.01" value={line.unitPriceHt} onChange={(e) => updateLine(i, { unitPriceHt: Number(e.target.value) || 0 })} />
              </label>
              <label className="flex flex-col gap-0.5 text-[10.5px] font-semibold text-muted">
                TVA
                <Select className="h-8 text-[12.5px]" value={line.vatRate} onChange={(e) => updateLine(i, { vatRate: Number(e.target.value) })}>
                  {VAT_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </label>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={items.length === 1}
                className="h-8 rounded-lg border border-line px-2 text-[11px] font-semibold text-muted hover:bg-soft disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
            + Ajouter une ligne
          </Button>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-line bg-soft p-3 text-[12.5px]">
          <div className="flex justify-between">
            <span className="text-muted">Total HT</span>
            <span className="font-semibold">{formatEUR(totals.totalHt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">TVA</span>
            <span className="font-semibold">{formatEUR(totals.totalVat)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-1 text-[13.5px]">
            <span className="font-bold">Total TTC</span>
            <span className="font-bold">{formatEUR(totals.totalTtc)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={submit} disabled={!canSubmit} className="w-full">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {validLines.length === 0 && <p className="mt-1.5 text-[11px] text-faint">Ajoutez au moins une ligne avec une description et une quantité.</p>}
      </div>
    </Drawer>
  );
}
