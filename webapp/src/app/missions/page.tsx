import Link from "next/link";
import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { listMissions, getBusinessTwinStatus, type MissionSummary } from "@/lib/actions/business-twin";
import { GoalPicker } from "@/components/business-twin/goal-picker";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "accent",
  succeeded: "success",
  failed: "neutral",
  abandoned: "neutral",
};

function MissionRow({ mission }: { mission: MissionSummary }) {
  const pct = mission.totalActions > 0 ? Math.round((mission.doneActions / mission.totalActions) * 100) : 0;
  return (
    <Link href={`/missions/${mission.id}`} className="flex flex-col gap-1.5 rounded-lg border border-line bg-bg px-3.5 py-3 hover:bg-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{mission.goalLabel}</span>
        {mission.deadline && (
          <span className="text-[11px] text-faint">Échéance : {new Date(mission.deadline).toLocaleDateString("fr-FR")}</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11.5px] text-muted">
        Progression : {mission.doneActions} / {mission.totalActions}
        {mission.risk.note ? ` — ${mission.risk.note}` : ""}
      </span>
    </Link>
  );
}

export default async function MissionsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const [missions, status] = await Promise.all([listMissions(workspaceId), getBusinessTwinStatus(workspaceId)]);

  const atRisk = missions.filter((m) => m.status === "active" && m.risk.status === "at_risk");
  const active = missions.filter((m) => m.status === "active" && m.risk.status !== "at_risk");
  const succeeded = missions.filter((m) => m.status === "succeeded");
  const closed = missions.filter((m) => m.status === "failed" || m.status === "abandoned");

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Missions</h1>
          <p className="mt-1 text-[13px] text-muted">Un objectif suivi dans le temps, avec son plan et sa progression réelle.</p>
        </div>

        <GoalPicker workspaceId={workspaceId} status={status} />

        {missions.length === 0 ? (
          <Card>
            <p className="text-[13px] text-muted">Aucune mission pour l&apos;instant — choisissez un objectif ci-dessus pour commencer.</p>
          </Card>
        ) : (
          <>
            {atRisk.length > 0 && (
              <Card>
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-bold text-ink">Missions en risque</h2>
                  <Badge tone="danger">{atRisk.length}</Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {atRisk.map((m) => (
                    <MissionRow key={m.id} mission={m} />
                  ))}
                </div>
              </Card>
            )}

            {active.length > 0 && (
              <Card>
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-bold text-ink">Missions actives</h2>
                  <Badge tone={STATUS_TONE.active}>{active.length}</Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {active.map((m) => (
                    <MissionRow key={m.id} mission={m} />
                  ))}
                </div>
              </Card>
            )}

            {succeeded.length > 0 && (
              <Card>
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-bold text-ink">Missions réussies</h2>
                  <Badge tone={STATUS_TONE.succeeded}>{succeeded.length}</Badge>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {succeeded.map((m) => (
                    <MissionRow key={m.id} mission={m} />
                  ))}
                </div>
              </Card>
            )}

            {closed.length > 0 && (
              <Card>
                <h2 className="text-[13px] font-bold text-ink">Missions terminées</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {closed.map((m) => (
                    <MissionRow key={m.id} mission={m} />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
