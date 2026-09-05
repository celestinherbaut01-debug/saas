"use client";

import { useMemo, useState } from "react";
import type {
  RepairOrder,
  Vehicle,
  Customer,
  TeamMember,
  Part,
  RepairOrderPart,
  BusinessDocument,
} from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import {
  REPAIR_STATUS_ORDER,
  REPAIR_STATUS_LABEL,
  DOC_TYPE_LABEL,
  DOC_STATUS_LABEL,
  partsTotals,
  formatEUR,
} from "@/lib/garage";

// Module 100% "contrôlé" : toutes les données (rows, technicians, parts,
// lines, documents) et toutes les mutations viennent de GarageView, qui est
// la SEULE source de vérité — indispensable ici, contrairement aux modules
// génériques (Clients/Véhicules) : un ordre de réparation a besoin de voir
// en temps réel les pièces/techniciens ajoutés depuis d'autres onglets.
interface Props {
  rows: RepairOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  technicians: TeamMember[];
  parts: Part[];
  lines: RepairOrderPart[];
  documents: BusinessDocument[];
  canManageTechnicians: boolean;
  onCreate: (input: { title: string; vehicleId: string; scheduledAt: string }) => void;
  onPatch: (id: string, patch: Partial<RepairOrder>) => void;
  onSetStatus: (order: RepairOrder, status: RepairOrder["status"]) => void;
  onRemove: (id: string) => void;
  onAddTechnician: (name: string) => Promise<string | null>;
  onAddLine: (
    orderId: string,
    input: { partId: string; partName: string; quantity: number; unitCost: number; unitPrice: number },
  ) => void;
  onRemoveLine: (line: RepairOrderPart) => void;
  onCreateDocument: (order: RepairOrder, docType: BusinessDocument["doc_type"]) => void;
  onSetDocumentStatus: (doc: BusinessDocument, status: BusinessDocument["status"]) => void;
  /** Permet à un autre onglet (Atelier) d'ouvrir la fiche complète d'un ordre. */
  openDetailId?: string | null;
  onOpenDetailIdChange?: (id: string | null) => void;
}

export function RepairOrdersModule({
  rows,
  vehicles,
  customers,
  technicians,
  parts,
  lines,
  documents,
  canManageTechnicians,
  onCreate,
  onPatch,
  onSetStatus,
  onRemove,
  onAddTechnician,
  onAddLine,
  onRemoveLine,
  onCreateDocument,
  onSetDocumentStatus,
  openDetailId,
  onOpenDetailIdChange,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);
  const detailId = openDetailId !== undefined ? openDetailId : localDetailId;
  const setDetailId = onOpenDetailIdChange ?? setLocalDetailId;

  function vehicleOf(id: string | null) {
    return id ? vehicles.find((v) => v.id === id) ?? null : null;
  }
  function customerOf(id: string | null) {
    return id ? customers.find((c) => c.id === id) ?? null : null;
  }
  function technicianOf(id: string | null) {
    return id ? technicians.find((t) => t.id === id) ?? null : null;
  }
  function linesOf(orderId: string) {
    return lines.filter((l) => l.repair_order_id === orderId);
  }
  function documentsOf(orderId: string) {
    return documents.filter((d) => d.repair_order_id === orderId);
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "active" && (r.status === "done" || r.status === "delivered")) return false;
      if (statusFilter !== "active" && statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const v = r.vehicle_id ? vehicles.find((veh) => veh.id === r.vehicle_id) : null;
      const c = r.customer_id ? customers.find((cust) => cust.id === r.customer_id) : null;
      return (
        r.title.toLowerCase().includes(q) ||
        (v ? `${v.registration} ${v.make} ${v.model}`.toLowerCase().includes(q) : false) ||
        (c ? c.name.toLowerCase().includes(q) : false)
      );
    });
  }, [rows, statusFilter, search, vehicles, customers]);

  const detailOrder = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Ordres de réparation</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nouvel ordre
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Rechercher (titre, véhicule, client)…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs flex-1" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="active">En cours</option>
          <option value="all">Tous les statuts</option>
          {REPAIR_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {REPAIR_STATUS_LABEL[s].text}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="🔧"
            title="Aucun ordre de réparation"
            description="Créez un ordre pour suivre une réparation du diagnostic à la livraison."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Nouvel ordre
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
                  <Th>Ordre</Th>
                  <Th>Véhicule</Th>
                  <Th>Client</Th>
                  <Th>Technicien</Th>
                  <Th>Statut</Th>
                  <Th>Prévu le</Th>
                  <Th className="text-right">Prix total</Th>
                </tr>
              </Thead>
              <tbody>
                {filtered.map((r) => {
                  const v = vehicleOf(r.vehicle_id);
                  const c = customerOf(r.customer_id);
                  const t = technicianOf(r.technician_id);
                  const price = r.labor_cost + partsTotals(linesOf(r.id)).price;
                  const overdue =
                    r.scheduled_at != null &&
                    new Date(r.scheduled_at).getTime() < new Date().getTime() &&
                    r.status !== "done" &&
                    r.status !== "delivered";
                  return (
                    <Tr key={r.id} onClick={() => setDetailId(r.id)}>
                      <Td className="font-semibold text-ink">{r.title}</Td>
                      <Td className="text-muted">{v ? `${v.registration} — ${v.make} ${v.model}` : "—"}</Td>
                      <Td className="text-muted">{c?.name ?? "—"}</Td>
                      <Td className="text-muted">{t?.name ?? "—"}</Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Badge tone={REPAIR_STATUS_LABEL[r.status].tone}>{REPAIR_STATUS_LABEL[r.status].text}</Badge>
                          {overdue && <Badge tone="danger">Retard</Badge>}
                        </div>
                      </Td>
                      <Td className="text-muted">
                        {r.scheduled_at ? new Date(r.scheduled_at).toLocaleDateString("fr-FR") : "—"}
                      </Td>
                      <Td className="text-right font-semibold">{formatEUR(price)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <CreateOrderDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        vehicles={vehicles}
        onCreate={(input) => {
          onCreate(input);
          setCreateOpen(false);
        }}
      />

      {detailOrder && (
        <RepairOrderDetail
          order={detailOrder}
          vehicle={vehicleOf(detailOrder.vehicle_id)}
          customer={customerOf(detailOrder.customer_id)}
          technicians={technicians}
          parts={parts}
          lines={linesOf(detailOrder.id)}
          documents={documentsOf(detailOrder.id)}
          canManageTechnicians={canManageTechnicians}
          onClose={() => setDetailId(null)}
          onPatch={(patch) => onPatch(detailOrder.id, patch)}
          onSetStatus={(s) => onSetStatus(detailOrder, s)}
          onRemove={() => {
            onRemove(detailOrder.id);
            setDetailId(null);
          }}
          onAddTechnician={onAddTechnician}
          onAddLine={(input) => onAddLine(detailOrder.id, input)}
          onRemoveLine={onRemoveLine}
          onCreateDocument={(docType) => onCreateDocument(detailOrder, docType)}
          onSetDocumentStatus={onSetDocumentStatus}
        />
      )}
    </Card>
  );
}

function CreateOrderDrawer({
  open,
  onClose,
  vehicles,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onCreate: (input: { title: string; vehicleId: string; scheduledAt: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  if (!open) return null;

  function submit() {
    if (!title.trim()) return;
    onCreate({ title, vehicleId, scheduledAt });
    setTitle("");
    setVehicleId("");
    setScheduledAt("");
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nouvel ordre de réparation" subtitle="Étape 1 : les détails (pièces, technicien, devis) se gèrent ensuite dans la fiche.">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Intitulé
          <Input placeholder="Ex. Vidange + plaquettes avant" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Véhicule
          <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Aucun véhicule associé</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration} — {v.make} {v.model}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Prévu le (optionnel)
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </label>
      </div>
      <div className="mt-5">
        <Button onClick={submit} disabled={!title.trim()} className="w-full">
          Créer l&apos;ordre
        </Button>
      </div>
    </Drawer>
  );
}

function RepairOrderDetail({
  order,
  vehicle,
  customer,
  technicians,
  parts,
  lines,
  documents,
  canManageTechnicians,
  onClose,
  onPatch,
  onSetStatus,
  onRemove,
  onAddTechnician,
  onAddLine,
  onRemoveLine,
  onCreateDocument,
  onSetDocumentStatus,
}: {
  order: RepairOrder;
  vehicle: Vehicle | null;
  customer: Customer | null;
  technicians: TeamMember[];
  parts: Part[];
  lines: RepairOrderPart[];
  documents: BusinessDocument[];
  canManageTechnicians: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<RepairOrder>) => void;
  onSetStatus: (s: RepairOrder["status"]) => void;
  onRemove: () => void;
  onAddTechnician: (name: string) => Promise<string | null>;
  onAddLine: (input: { partId: string; partName: string; quantity: number; unitCost: number; unitPrice: number }) => void;
  onRemoveLine: (line: RepairOrderPart) => void;
  onCreateDocument: (docType: BusinessDocument["doc_type"]) => void;
  onSetDocumentStatus: (doc: BusinessDocument, status: BusinessDocument["status"]) => void;
}) {
  const [laborCost, setLaborCost] = useState(String(order.labor_cost));
  const [notes, setNotes] = useState(order.notes);
  const [newTechName, setNewTechName] = useState("");
  const [showAddTech, setShowAddTech] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [lineQty, setLineQty] = useState("1");

  const totals = partsTotals(lines);
  const totalPrice = order.labor_cost + totals.price;
  const margin = totalPrice - totals.cost;

  async function submitTechnician(id: string) {
    if (id === "__new__") {
      setShowAddTech(true);
      return;
    }
    onPatch({ technician_id: id || null });
  }

  async function confirmNewTechnician() {
    if (!newTechName.trim()) return;
    const id = await onAddTechnician(newTechName);
    if (id) onPatch({ technician_id: id });
    setNewTechName("");
    setShowAddTech(false);
  }

  function submitLine() {
    const part = parts.find((p) => p.id === selectedPartId);
    const qty = Number(lineQty) || 1;
    if (!part) return;
    onAddLine({ partId: part.id, partName: part.name, quantity: qty, unitCost: part.unit_cost, unitPrice: part.unit_price });
    setSelectedPartId("");
    setLineQty("1");
  }

  return (
    <Drawer open onClose={onClose} title={order.title} subtitle={vehicle ? `${vehicle.registration} — ${vehicle.make} ${vehicle.model}` : undefined} width="lg">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {REPAIR_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSetStatus(s)}
              className={
                s === order.status
                  ? "rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-bg"
                  : "rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-soft"
              }
            >
              {REPAIR_STATUS_LABEL[s].text}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Client</p>
            <p className="mt-0.5 font-semibold">{customer?.name ?? "Non associé"}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Véhicule</p>
            <p className="mt-0.5 font-semibold">{vehicle ? `${vehicle.registration} — ${vehicle.make} ${vehicle.model}` : "Non associé"}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Technicien</p>
            {!showAddTech ? (
              <Select className="mt-1 h-8 w-full" value={order.technician_id ?? ""} onChange={(e) => submitTechnician(e.target.value)}>
                <option value="">Non assigné</option>
                {technicians
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                <option value="__new__">+ Ajouter un technicien…</option>
              </Select>
            ) : (
              <div className="mt-1 flex gap-1.5">
                <Input placeholder="Nom" value={newTechName} onChange={(e) => setNewTechName(e.target.value)} className="h-8 flex-1" />
                <Button size="sm" onClick={confirmNewTechnician}>
                  OK
                </Button>
              </div>
            )}
            {!canManageTechnicians && (
              <p className="mt-1 text-[10.5px] text-faint">Gestion complète de l&apos;équipe réservée au Business OS avancé.</p>
            )}
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Prévu le</p>
            <Input
              type="datetime-local"
              className="mt-1 h-8"
              value={order.scheduled_at ? order.scheduled_at.slice(0, 16) : ""}
              onChange={(e) => onPatch({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Pièces utilisées</p>
          {lines.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                  <span>
                    {l.part_name} <span className="text-faint">× {l.quantity}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{formatEUR(l.unit_price * l.quantity)}</span>
                    <button onClick={() => onRemoveLine(l)} className="text-[11px] text-faint hover:text-red-fg">
                      Retirer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Select className="h-9 flex-1" value={selectedPartId} onChange={(e) => setSelectedPartId(e.target.value)}>
              <option value="">Choisir une pièce…</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.quantity} {p.unit} en stock — {formatEUR(p.unit_price)})
                </option>
              ))}
            </Select>
            <Input type="number" min="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} className="h-9 w-16" />
            <Button size="sm" onClick={submitLine} disabled={!selectedPartId}>
              Ajouter
            </Button>
          </div>
          {parts.length === 0 && <p className="mt-1 text-[11px] text-faint">Aucune pièce au catalogue — ajoutez-en dans l&apos;onglet Pièces.</p>}
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Coût / Prix</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12.5px]">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
              Main d&apos;œuvre (prix)
              <Input
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                onBlur={() => onPatch({ labor_cost: Number(laborCost) || 0 })}
                className="h-8"
              />
            </label>
            <div className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
              Prix pièces
              <p className="mt-1 font-display text-[14px] font-bold text-ink">{formatEUR(totals.price)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-soft px-3 py-2.5">
            <span className="text-[12px] font-semibold text-muted">Prix total client</span>
            <span className="font-display text-[15px] font-extrabold">{formatEUR(totalPrice)}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            Coût pièces {formatEUR(totals.cost)} · Marge estimée {formatEUR(margin)} (main d&apos;œuvre non déduite du
            coût — non suivie séparément)
          </p>
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Devis / Facture</p>
          {documents.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                  <span>
                    <b>{d.number || DOC_TYPE_LABEL[d.doc_type]}</b> <span className="text-faint">— {formatEUR(d.total_ttc)}</span>
                  </span>
                  <Select className="h-7 text-[11px]" value={d.status} onChange={(e) => onSetDocumentStatus(d, e.target.value as BusinessDocument["status"])}>
                    {Object.entries(DOC_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.text}
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onCreateDocument("quote")}>
              + Créer un devis
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCreateDocument("invoice")}>
              + Créer une facture
            </Button>
          </div>
          <p className="mt-1.5 text-[10.5px] text-faint">TVA non gérée : montant unique affiché (pas de séparation HT/TTC).</p>
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Notes</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onPatch({ notes })}
            rows={3}
            className="mt-1.5"
            placeholder="Diagnostic, remarques, historique de l'intervention…"
          />
        </div>

        <button type="button" onClick={onRemove} className="self-start text-[11.5px] font-semibold text-faint hover:text-red-fg">
          Supprimer cet ordre de réparation
        </button>
      </div>
    </Drawer>
  );
}
