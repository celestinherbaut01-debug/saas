"use client";

import { useState } from "react";
import type { Vehicle, Customer, RepairOrder } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { REPAIR_STATUS_LABEL } from "@/lib/garage";

interface ControlledVehicles {
  rows: Vehicle[];
  onCreate: (input: { registration: string; make: string; model: string; year: string; mileage: string; customerId: string; notes: string }) => void;
  onUpdate: (id: string, patch: Partial<Vehicle>) => void;
  onRemove: (id: string) => void;
}

export function VehiclesModule({
  workspaceId,
  initial,
  customers,
  repairOrders = [],
  controlled,
}: {
  workspaceId: string;
  initial: Vehicle[];
  customers: Customer[];
  repairOrders?: RepairOrder[];
  controlled?: ControlledVehicles;
}) {
  const supabase = createClient();
  const [localRows, setLocalRows] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const rows = controlled ? controlled.rows : localRows;

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }
  function historyOf(vehicleId: string) {
    return repairOrders.filter((r) => r.vehicle_id === vehicleId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async function create(input: { registration: string; make: string; model: string; year: string; mileage: string; customerId: string; notes: string }) {
    if (!input.registration.trim()) return;
    if (controlled) {
      controlled.onCreate(input);
      setCreateOpen(false);
      return;
    }
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        workspace_id: workspaceId,
        registration: input.registration.trim().toUpperCase(),
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year ? Number(input.year) : null,
        mileage: input.mileage ? Number(input.mileage) : null,
        customer_id: input.customerId || null,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if (!error && data) {
      setLocalRows((prev) => [data, ...prev]);
      setCreateOpen(false);
    }
  }

  async function update(id: string, patch: Partial<Vehicle>) {
    if (controlled) {
      controlled.onUpdate(id, patch);
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
    if (!error) {
      setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setEditing(null);
    }
  }

  async function remove(id: string) {
    if (controlled) {
      controlled.onRemove(id);
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (!error) {
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
      setEditing(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">Véhicules</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Ajouter
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="🚗"
            title="Aucun véhicule"
            description="Ajoutez un véhicule pour pouvoir créer des ordres de réparation."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Ajouter
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
                  <Th>Immatriculation</Th>
                  <Th>Véhicule</Th>
                  <Th>Propriétaire</Th>
                  <Th>Kilométrage</Th>
                  <Th className="text-right">Historique</Th>
                </tr>
              </Thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id} onClick={() => setEditing(r)}>
                    <Td className="font-display font-bold text-ink">{r.registration}</Td>
                    <Td className="text-muted">
                      {r.make} {r.model} {r.year ? `(${r.year})` : ""}
                    </Td>
                    <Td className="text-muted">{customerName(r.customer_id)}</Td>
                    <Td className="text-muted">{r.mileage != null ? `${r.mileage.toLocaleString("fr-FR")} km` : "—"}</Td>
                    <Td className="text-right text-muted">{historyOf(r.id).length} ordre(s)</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}

      <VehicleDrawer open={createOpen} title="Ajouter un véhicule" initial={null} customers={customers} onClose={() => setCreateOpen(false)} onSubmit={create} />
      {editing && (
        <VehicleDrawer
          open
          title={editing.registration}
          initial={editing}
          customers={customers}
          history={historyOf(editing.id)}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            update(editing.id, {
              registration: input.registration.trim().toUpperCase(),
              make: input.make.trim(),
              model: input.model.trim(),
              year: input.year ? Number(input.year) : null,
              mileage: input.mileage ? Number(input.mileage) : null,
              customer_id: input.customerId || null,
              notes: input.notes.trim(),
            })
          }
          onDelete={() => remove(editing.id)}
        />
      )}
    </Card>
  );
}

function VehicleDrawer({
  open,
  title,
  initial,
  customers,
  history,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  initial: Vehicle | null;
  customers: Customer[];
  history?: RepairOrder[];
  onClose: () => void;
  onSubmit: (input: { registration: string; make: string; model: string; year: string; mileage: string; customerId: string; notes: string }) => void;
  onDelete?: () => void;
}) {
  const [registration, setRegistration] = useState(initial?.registration ?? "");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year != null ? String(initial.year) : "");
  const [mileage, setMileage] = useState(initial?.mileage != null ? String(initial.mileage) : "");
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Immatriculation
            <Input value={registration} onChange={(e) => setRegistration(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Année
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Marque
            <Input value={make} onChange={(e) => setMake(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Modèle
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Kilométrage
            <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Propriétaire
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
          Notes
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {history && history.length > 0 && (
        <div className="mt-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Historique des réparations</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                <span>{h.title}</span>
                <Badge tone={REPAIR_STATUS_LABEL[h.status].tone}>{REPAIR_STATUS_LABEL[h.status].text}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => onSubmit({ registration, make, model, year, mileage, customerId, notes })}
          disabled={!registration.trim()}
        >
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
