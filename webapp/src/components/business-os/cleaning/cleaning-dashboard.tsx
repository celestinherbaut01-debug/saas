"use client";

import type { Contract, Intervention, Incident, InventoryItem } from "@/lib/supabase/types";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import type { CleaningAlert } from "@/lib/cleaning";

export function CleaningDashboard({
  contracts,
  interventions,
  incidents,
  inventory,
  alerts,
}: {
  contracts: Contract[];
  interventions: Intervention[];
  incidents: Incident[];
  inventory: InventoryItem[];
  alerts: CleaningAlert[];
}) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const activeContracts = contracts.filter((c) => c.status === "active");
  const renewals = contracts.filter((c) => c.status === "ending_soon");
  const today = interventions.filter((it) => new Date(it.scheduled_at) >= startOfDay && new Date(it.scheduled_at) < endOfDay);
  const upcoming = interventions.filter((it) => it.status === "planned" && new Date(it.scheduled_at) >= now).length;
  const openIncidents = incidents.filter((i) => i.status === "open");
  const lowStock = inventory.filter((i) => i.low_stock_threshold != null && i.quantity <= i.low_stock_threshold);
  const recurringRevenue = activeContracts.reduce((s, c) => s + c.monthly_price, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sites sous contrat" value={String(activeContracts.length)} />
        <StatTile label="Contrats à renouveler" value={String(renewals.length)} />
        <StatTile label="Interventions aujourd'hui" value={String(today.length)} />
        <StatTile label="Interventions à venir" value={String(upcoming)} />
        <StatTile label="Incidents ouverts" value={String(openIncidents.length)} />
        <StatTile label="Consommables en stock faible" value={String(lowStock.length)} />
        <StatTile label="Revenus récurrents / mois" value={`${recurringRevenue.toFixed(0)} €`} sub="Somme des contrats actifs" />
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-bg bg-amber-bg/40">
          <h2 className="text-[13px] font-bold text-ink">Alertes</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
            {alerts.slice(0, 6).map((a, i) => (
              <li key={i} className="text-amber-fg">
                {a.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
