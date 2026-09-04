"use client";

import type { Intervention, Site, TeamMember } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { INTERVENTION_STATUS_LABEL } from "@/lib/cleaning";

export function PlanningModule({
  rows,
  sites,
  teamMembers,
  onOpenDetail,
}: {
  rows: Intervention[];
  sites: Site[];
  teamMembers: TeamMember[];
  onOpenDetail: (id: string) => void;
}) {
  const upcoming = rows.filter((it) => it.status === "planned").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  function siteName(id: string | null) {
    return id ? sites.find((s) => s.id === id)?.name ?? "—" : "—";
  }
  function teamMemberName(id: string | null) {
    return id ? teamMembers.find((t) => t.id === id)?.name ?? "—" : "—";
  }

  const byDay = new Map<string, Intervention[]>();
  for (const it of upcoming) {
    const day = new Date(it.scheduled_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    byDay.set(day, [...(byDay.get(day) ?? []), it]);
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Planning</h2>
      {upcoming.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📅" title="Rien de planifié" description="Planifiez une intervention depuis l'onglet Interventions." />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {[...byDay.entries()].map(([day, items]) => (
            <div key={day}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">{day}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12px]">
                    <button type="button" onClick={() => onOpenDetail(it.id)} className="text-left font-semibold text-ink hover:text-accent">
                      {new Date(it.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — {siteName(it.site_id)}
                      <span className="ml-1.5 font-normal text-faint">{teamMemberName(it.team_member_id)}</span>
                    </button>
                    <Badge tone={INTERVENTION_STATUS_LABEL[it.status].tone}>{INTERVENTION_STATUS_LABEL[it.status].text}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
