"use client";

import { useState } from "react";
import type {
  Customer,
  InventoryItem,
  Appointment,
  Project,
  WasteLogEntry,
} from "@/lib/supabase/types";
import type { BusinessOsProfile, BusinessOsVertical } from "@/lib/business-os";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { cn } from "@/lib/utils";
import { CustomersModule } from "@/components/business-os/customers-module";
import { InventoryModule } from "@/components/business-os/inventory-module";
import { AppointmentsModule } from "@/components/business-os/appointments-module";
import { ProjectsModule } from "@/components/business-os/projects-module";
import { WasteLogModule } from "@/components/business-os/waste-log-module";

// Garage et Nettoyage ont désormais leur propre vue dédiée (GarageView,
// CleaningView), bien plus riche — ce composant générique ne gère plus que
// Agence/Restaurant/Générique. Voir business-os/page.tsx pour l'aiguillage.
type TabKey = "overview" | "customers" | "inventory" | "appointments" | "projects" | "waste_log";

const VERTICAL_TABS: Record<Exclude<BusinessOsVertical, "garage" | "cleaning">, TabKey[]> = {
  generic: ["overview", "customers", "inventory", "appointments"],
  agency: ["overview", "customers", "projects", "inventory", "appointments"],
  restaurant: ["overview", "customers", "inventory", "waste_log", "appointments"],
};

export function BusinessOsView({
  vertical,
  profile,
  isAdvanced,
  workspaceId,
  kpis,
  untrackedNote,
  history,
  customers,
  inventory,
  appointments,
  projects,
  wasteLog,
  lowStock,
}: {
  vertical: Exclude<BusinessOsVertical, "garage" | "cleaning">;
  profile: BusinessOsProfile;
  isAdvanced: boolean;
  workspaceId: string;
  kpis: { label: string; value: string; sub?: string }[];
  untrackedNote?: string;
  history: { id: string; label: string; date: string }[];
  customers: Customer[];
  inventory: InventoryItem[];
  appointments: Appointment[];
  projects: Project[];
  wasteLog: WasteLogEntry[];
  lowStock: InventoryItem[];
}) {
  const tabs = VERTICAL_TABS[vertical];
  const [active, setActive] = useState<TabKey>("overview");

  const TAB_LABEL: Record<TabKey, string> = {
    overview: "Vue d'ensemble",
    customers: profile.customersLabel,
    inventory: profile.inventoryLabel,
    appointments: profile.appointmentsLabel,
    projects: "Projets",
    waste_log: "Pertes",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={cn(
              "rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition-colors",
              active === tab ? "bg-panel text-ink shadow-[0_1px_0_0_var(--panel)]" : "text-muted hover:text-ink",
            )}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {active === "overview" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kpis.map((k) => (
              <StatTile key={k.label} label={k.label} value={k.value} sub={k.sub} />
            ))}
          </div>

          {isAdvanced && history.length > 0 && (
            <Card>
              <h2 className="text-[13px] font-bold text-ink">
                Historique complet <span className="font-normal text-faint">— réservé au plan Max</span>
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-muted">
                {history.slice(0, 8).map((h) => (
                  <li key={h.id} className="flex justify-between gap-3">
                    <span>{h.label}</span>
                    <span className="shrink-0 text-faint">{h.date}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isAdvanced && lowStock.length > 0 && (
            <Card className="border-amber-bg bg-amber-bg">
              <h2 className="text-[13px] font-bold text-amber-fg">⚠ Alertes stock bas ({lowStock.length})</h2>
              <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-amber-fg">
                {lowStock.map((item) => (
                  <li key={item.id}>
                    {item.name} — {item.quantity} {item.unit} restant(s) (seuil : {item.low_stock_threshold})
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {untrackedNote && (
            <p className="text-[11.5px] text-faint">
              Pas encore suivi dans cette vue d&apos;ensemble : {untrackedNote}.
            </p>
          )}

          {!isAdvanced && (
            <Card className="border-line bg-soft text-center">
              <p className="text-[12.5px] text-muted">
                Le plan Max ajoute les alertes de stock bas, NOVA connectée à ces données, et l&apos;équipe
                (jusqu&apos;à 5 utilisateurs).{" "}
                <a href="/abonnement" className="font-semibold text-accent">
                  Voir le plan Max
                </a>
              </p>
            </Card>
          )}
        </div>
      )}

      {active === "customers" && (
        <CustomersModule workspaceId={workspaceId} initial={customers} label={profile.customersLabel} />
      )}
      {active === "inventory" && (
        <InventoryModule workspaceId={workspaceId} initial={inventory} label={profile.inventoryLabel} />
      )}
      {active === "appointments" && (
        <AppointmentsModule workspaceId={workspaceId} initial={appointments} label={profile.appointmentsLabel} />
      )}
      {active === "projects" && <ProjectsModule workspaceId={workspaceId} initial={projects} customers={customers} />}
      {active === "waste_log" && <WasteLogModule workspaceId={workspaceId} initial={wasteLog} />}
    </div>
  );
}
