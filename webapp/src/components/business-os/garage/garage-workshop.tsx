"use client";

import type { RepairOrder, Vehicle, Customer, TeamMember } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { REPAIR_STATUS_LABEL } from "@/lib/garage";

// Colonnes actives seulement — "Livré" quitte l'atelier, il vit dans
// Historique. Vue Kanban en lecture + avancement rapide (pas de
// glisser-déposer, mais un vrai changement de statut réel en un clic).
const WORKSHOP_COLUMNS: RepairOrder["status"][] = ["diagnostic", "quote", "accepted", "in_progress", "waiting_parts", "done"];

const NEXT_STATUS: Partial<Record<RepairOrder["status"], RepairOrder["status"]>> = {
  diagnostic: "quote",
  quote: "accepted",
  accepted: "in_progress",
  in_progress: "done",
  waiting_parts: "in_progress",
  done: "delivered",
};

export function WorkshopModule({
  rows,
  vehicles,
  customers,
  technicians,
  onAdvance,
  onOpenDetail,
}: {
  rows: RepairOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  technicians: TeamMember[];
  onAdvance: (order: RepairOrder, next: RepairOrder["status"]) => void;
  onOpenDetail: (id: string) => void;
}) {
  const active = rows.filter((r) => r.status !== "delivered");

  function vehicleOf(id: string | null) {
    return id ? vehicles.find((v) => v.id === id) ?? null : null;
  }
  function customerOf(id: string | null) {
    return id ? customers.find((c) => c.id === id) ?? null : null;
  }
  function technicianOf(id: string | null) {
    return id ? technicians.find((t) => t.id === id) ?? null : null;
  }

  if (active.length === 0) {
    return (
      <Card>
        <h2 className="font-display text-sm font-bold">Atelier</h2>
        <div className="mt-4">
          <EmptyState icon="🏭" title="Atelier vide" description="Les ordres de réparation actifs apparaîtront ici, organisés par étape." />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Atelier</h2>
      <p className="mt-1 text-[11.5px] text-muted">Vue d&apos;ensemble en temps réel des véhicules dans l&apos;atelier, par étape.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-3 lg:grid-cols-6">
        {WORKSHOP_COLUMNS.map((status) => {
          const items = active.filter((r) => r.status === status);
          const next = NEXT_STATUS[status];
          return (
            <div key={status} className="flex min-w-[180px] flex-col gap-2 rounded-xl bg-soft p-2.5">
              <div className="flex items-center justify-between px-0.5">
                <Badge tone={REPAIR_STATUS_LABEL[status].tone}>{REPAIR_STATUS_LABEL[status].text}</Badge>
                <span className="text-[10.5px] font-bold text-faint">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((r) => {
                  const v = vehicleOf(r.vehicle_id);
                  const t = technicianOf(r.technician_id);
                  return (
                    <div key={r.id} className="rounded-lg border border-line bg-panel p-2.5 text-[11.5px] shadow-sm">
                      <button type="button" onClick={() => onOpenDetail(r.id)} className="text-left font-semibold text-ink hover:text-accent">
                        {r.title}
                      </button>
                      <p className="mt-0.5 text-faint">{v ? `${v.registration}` : customerOf(r.customer_id)?.name ?? "—"}</p>
                      {t && <p className="text-faint">{t.name}</p>}
                      {next && (
                        <button
                          type="button"
                          onClick={() => onAdvance(r, next)}
                          className="mt-1.5 w-full rounded-md border border-line bg-soft px-2 py-1 text-[10.5px] font-bold text-muted hover:bg-accent/10 hover:text-accent"
                        >
                          → {REPAIR_STATUS_LABEL[next].text}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
