"use client";

import type { RepairOrder, Vehicle, Customer } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { REPAIR_STATUS_LABEL, REPAIR_STATUS_ACTIVE } from "@/lib/garage";

// Vue agenda (liste groupée par jour), pas un calendrier en grille avec
// glisser-déposer — une vraie vue de planification, plus simple qu'un
// calendrier visuel complet.
export function PlanningModule({
  rows,
  vehicles,
  customers,
  onOpenDetail,
}: {
  rows: RepairOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  onOpenDetail: (id: string) => void;
}) {
  const active = rows.filter((r) => REPAIR_STATUS_ACTIVE.includes(r.status));
  const scheduled = active.filter((r) => r.scheduled_at).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const unscheduled = active.filter((r) => !r.scheduled_at);

  function vehicleOf(id: string | null) {
    return id ? vehicles.find((v) => v.id === id) ?? null : null;
  }
  function customerOf(id: string | null) {
    return id ? customers.find((c) => c.id === id) ?? null : null;
  }

  const byDay = new Map<string, RepairOrder[]>();
  for (const r of scheduled) {
    const day = new Date(r.scheduled_at!).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Planning</h2>
      {scheduled.length === 0 && unscheduled.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📅" title="Rien de planifié" description="Renseignez une date prévue sur un ordre de réparation pour le voir ici." />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {[...byDay.entries()].map(([day, orders]) => (
            <div key={day}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">{day}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {orders.map((r) => {
                  const v = vehicleOf(r.vehicle_id);
                  return (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                      <button type="button" onClick={() => onOpenDetail(r.id)} className="text-left font-semibold text-ink hover:text-accent">
                        {new Date(r.scheduled_at!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — {r.title}
                        <span className="ml-1.5 font-normal text-faint">{v ? v.registration : customerOf(r.customer_id)?.name ?? ""}</span>
                      </button>
                      <Badge tone={REPAIR_STATUS_LABEL[r.status].tone}>{REPAIR_STATUS_LABEL[r.status].text}</Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {unscheduled.length > 0 && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">Non planifiés</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {unscheduled.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border border-dashed border-line px-3 py-2 text-[12px]">
                    <button type="button" onClick={() => onOpenDetail(r.id)} className="text-left font-semibold text-ink hover:text-accent">
                      {r.title}
                    </button>
                    <Badge tone={REPAIR_STATUS_LABEL[r.status].tone}>{REPAIR_STATUS_LABEL[r.status].text}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
