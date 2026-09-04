"use client";

import type { RepairOrder, Vehicle, Customer, Part, BusinessDocument } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { REPAIR_STATUS_ACTIVE, REPAIR_STATUS_LABEL, formatEUR, type GarageAlert } from "@/lib/garage";

export function GarageDashboard({
  repairOrders,
  vehicles,
  customers,
  parts,
  documents,
  alerts,
  onOpenDetail,
}: {
  repairOrders: RepairOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  parts: Part[];
  documents: BusinessDocument[];
  alerts: GarageAlert[];
  onOpenDetail: (id: string) => void;
}) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const active = repairOrders.filter((r) => REPAIR_STATUS_ACTIVE.includes(r.status));
  const vehiclesInShop = new Set(active.map((r) => r.vehicle_id).filter(Boolean)).size;
  const today = active.filter((r) => r.scheduled_at && new Date(r.scheduled_at) >= startOfDay && new Date(r.scheduled_at) < endOfDay);
  const overdue = active.filter((r) => r.scheduled_at && new Date(r.scheduled_at).getTime() < now.getTime());
  const lowStock = parts.filter((p) => p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold);

  const invoicesThisMonth = documents.filter(
    (d) => d.doc_type === "invoice" && d.status !== "canceled" && d.status !== "refused" && new Date(d.issued_at) >= monthStart,
  );
  const revenueThisMonth = invoicesThisMonth.reduce((s, d) => s + d.total_ttc, 0);
  const avgBasket = invoicesThisMonth.length > 0 ? revenueThisMonth / invoicesThisMonth.length : 0;

  const upcoming = active
    .filter((r) => r.scheduled_at && new Date(r.scheduled_at) >= now)
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .slice(0, 5);

  function vehicleOf(id: string | null) {
    return id ? vehicles.find((v) => v.id === id) ?? null : null;
  }
  function customerOf(id: string | null) {
    return id ? customers.find((c) => c.id === id) ?? null : null;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Véhicules en atelier" value={String(vehiclesInShop)} />
        <StatTile label="Réparations aujourd'hui" value={String(today.length)} />
        <StatTile label="Réparations en retard" value={String(overdue.length)} />
        <StatTile label="CA du mois" value={formatEUR(revenueThisMonth)} sub={`${invoicesThisMonth.length} facture(s)`} />
        <StatTile label="Panier moyen" value={formatEUR(avgBasket)} />
        <StatTile label="Pièces en stock faible" value={String(lowStock.length)} />
        <StatTile label="Ordres actifs" value={String(active.length)} />
        <StatTile label="Prochain RDV" value={upcoming[0] ? new Date(upcoming[0].scheduled_at!).toLocaleDateString("fr-FR") : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-[13px] font-bold text-ink">Prochains rendez-vous</h2>
          {upcoming.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon="📅" title="Rien de prévu" description="Planifiez un ordre de réparation pour le voir ici." />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {upcoming.map((r) => {
                const v = vehicleOf(r.vehicle_id);
                return (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
                    <button type="button" onClick={() => onOpenDetail(r.id)} className="text-left font-semibold text-ink hover:text-accent">
                      {new Date(r.scheduled_at!).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} — {r.title}
                      <span className="ml-1.5 font-normal text-faint">{v ? v.registration : customerOf(r.customer_id)?.name ?? ""}</span>
                    </button>
                    <Badge tone={REPAIR_STATUS_LABEL[r.status].tone}>{REPAIR_STATUS_LABEL[r.status].text}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className={alerts.length > 0 ? "border-amber-bg bg-amber-bg/40" : undefined}>
          <h2 className="text-[13px] font-bold text-ink">Alertes</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted">Aucune alerte pour l&apos;instant.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
              {alerts.slice(0, 6).map((a, i) => (
                <li key={i} className="text-amber-fg">
                  {a.text}
                </li>
              ))}
              {alerts.length > 6 && <li className="text-faint">+ {alerts.length - 6} autre(s) — voir l&apos;onglet Alertes</li>}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
