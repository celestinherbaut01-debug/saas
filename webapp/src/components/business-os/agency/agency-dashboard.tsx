"use client";

import type { ClientSite, Project, Ticket } from "@/lib/supabase/types";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { formatEUR, type AgencyAlert } from "@/lib/agency";

export function AgencyDashboard({
  sites,
  projects,
  tickets,
  alerts,
}: {
  sites: ClientSite[];
  projects: Project[];
  tickets: Ticket[];
  alerts: AgencyAlert[];
}) {
  const now = new Date().getTime();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  const expiringDomains = sites.filter((s) => s.domain_renewal_date && new Date(s.domain_renewal_date).getTime() < in30Days).length;
  const maintenanceDue = sites.filter((s) => s.next_maintenance_at && new Date(s.next_maintenance_at).getTime() < now).length;
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const overdueProjects = projects.filter((p) => p.deadline && new Date(p.deadline).getTime() < now && p.status !== "done").length;
  const recurringRevenue = sites.filter((s) => s.status === "active").reduce((s, site) => s + site.monthly_price, 0);
  const activeProjects = projects.filter((p) => p.status !== "done").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Projets en cours" value={String(activeProjects)} />
        <StatTile label="Projets en retard" value={String(overdueProjects)} />
        <StatTile label="Domaines expirant (30j)" value={String(expiringDomains)} />
        <StatTile label="Maintenance à faire" value={String(maintenanceDue)} />
        <StatTile label="Tickets ouverts" value={String(openTickets)} />
        <StatTile label="Revenus récurrents / mois" value={formatEUR(recurringRevenue)} sub="Sites actifs" />
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
