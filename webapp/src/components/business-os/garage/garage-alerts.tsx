"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { GarageAlert } from "@/lib/garage";
import { cn } from "@/lib/utils";

export function AlertsModule({ alerts, advanced }: { alerts: GarageAlert[]; advanced: boolean }) {
  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Alertes</h2>
      <p className="mt-1 text-[11.5px] text-muted">
        {advanced
          ? "Stock bas, retards, devis sans réponse, charge technicien — calculées en direct sur vos données."
          : "Stock bas et retards. Le plan Max ajoute les devis en attente et la charge par technicien."}
      </p>

      {alerts.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="✓" title="Aucune alerte" description="Tout est sous contrôle pour l'instant." />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {alerts.map((a, i) => (
            <li
              key={i}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-[12.5px] font-medium",
                a.level === "danger" ? "border-red-bg bg-red-bg text-red-fg" : "border-amber-bg bg-amber-bg text-amber-fg",
              )}
            >
              {a.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
