"use client";

import { useState } from "react";
import type { RepairOrder, Vehicle, Customer, RepairOrderPart } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { REPAIR_STATUS_LABEL, partsTotals, formatEUR } from "@/lib/garage";

export function HistoryModule({
  rows,
  vehicles,
  customers,
  lines,
  onOpenDetail,
}: {
  rows: RepairOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  lines: RepairOrderPart[];
  onOpenDetail: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const done = rows
    .filter((r) => r.status === "done" || r.status === "delivered")
    .sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));

  function vehicleOf(id: string | null) {
    return id ? vehicles.find((v) => v.id === id) ?? null : null;
  }
  function customerOf(id: string | null) {
    return id ? customers.find((c) => c.id === id) ?? null : null;
  }

  const filtered = done.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const v = vehicleOf(r.vehicle_id);
    const c = customerOf(r.customer_id);
    return r.title.toLowerCase().includes(q) || (v ? v.registration.toLowerCase().includes(q) : false) || (c ? c.name.toLowerCase().includes(q) : false);
  });

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Historique</h2>
      <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-3 max-w-xs" />

      {filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🗂" title="Aucune réparation terminée" description="Les ordres marqués Terminé ou Livré apparaîtront ici." />
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
                  <Th>Terminé le</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">Prix</Th>
                </tr>
              </Thead>
              <tbody>
                {filtered.map((r) => {
                  const v = vehicleOf(r.vehicle_id);
                  const c = customerOf(r.customer_id);
                  const price = r.labor_cost + partsTotals(lines.filter((l) => l.repair_order_id === r.id)).price;
                  return (
                    <Tr key={r.id} onClick={() => onOpenDetail(r.id)}>
                      <Td className="font-semibold text-ink">{r.title}</Td>
                      <Td className="text-muted">{v?.registration ?? "—"}</Td>
                      <Td className="text-muted">{c?.name ?? "—"}</Td>
                      <Td className="text-muted">{r.completed_at ? new Date(r.completed_at).toLocaleDateString("fr-FR") : "—"}</Td>
                      <Td>
                        <Badge tone={REPAIR_STATUS_LABEL[r.status].tone}>{REPAIR_STATUS_LABEL[r.status].text}</Badge>
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
    </Card>
  );
}
