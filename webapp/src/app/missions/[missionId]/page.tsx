import { redirect } from "next/navigation";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { getMissionDetail } from "@/lib/actions/business-twin";
import { goalTemplate } from "@/lib/business-twin/goals";
import { MissionActionItem } from "@/components/business-twin/mission-action-item";
import { AdjustMissionButton } from "@/components/business-twin/adjust-mission-button";
import type { DataField } from "@/lib/business-twin/types";

const STATUS_LABEL: Record<string, { text: string; tone: BadgeTone }> = {
  active: { text: "Active", tone: "accent" },
  at_risk: { text: "À risque", tone: "danger" },
  succeeded: { text: "Réussie", tone: "success" },
  failed: { text: "Échouée", tone: "neutral" },
  abandoned: { text: "Abandonnée", tone: "neutral" },
};

const FIELD_STATUS_LABEL: Record<DataField<unknown>["status"], { text: string; tone: BadgeTone }> = {
  real: { text: "Réel", tone: "success" },
  estimated: { text: "Estimation", tone: "accent" },
  hypothesis: { text: "Hypothèse", tone: "warning" },
  insufficient: { text: "Donnée insuffisante", tone: "neutral" },
};

function formatFieldValue(field: DataField<unknown>): string {
  if (field.status === "insufficient") return field.reason;
  const v = field.value;
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

export default async function MissionDetailPage({ params }: PageProps<"/missions/[missionId]">) {
  const { missionId } = await params;
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard");
  const workspaceId = membership.workspace_id;

  const detail = await getMissionDetail(workspaceId, missionId);
  if ("error" in detail) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <p className="text-[13px] text-muted">{detail.error}</p>
        </Card>
      </AppShell>
    );
  }

  const template = goalTemplate(detail.goalType);
  const displayStatus = detail.risk.status === "at_risk" && detail.status === "active" ? "at_risk" : detail.status;
  const pct = detail.actions.length > 0 ? Math.round((detail.actions.filter((a) => a.status === "done").length / detail.actions.length) * 100) : 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              {template.icon} {detail.goalLabel}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              {detail.goalTargetValue != null && `Cible : ${detail.goalTargetValue} ${detail.goalTargetUnit ?? ""}`}
              {detail.deadline && ` — Échéance : ${new Date(detail.deadline).toLocaleDateString("fr-FR")}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={STATUS_LABEL[displayStatus]?.tone ?? "neutral"}>{STATUS_LABEL[displayStatus]?.text ?? displayStatus}</Badge>
            {detail.status === "active" && <AdjustMissionButton workspaceId={workspaceId} missionId={detail.id} />}
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-ink">Progression</h2>
            <span className="text-[12.5px] font-semibold text-ink">
              {detail.actions.filter((a) => a.status === "done").length} / {detail.actions.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          {detail.risk.note && <p className="mt-2 text-[12px] font-medium text-amber-fg">✦ NOVA : {detail.risk.note}</p>}
        </Card>

        {detail.blockers.length > 0 && (
          <Card className="border-red-fg/30">
            <h2 className="text-[13px] font-bold text-ink">Bloquants</h2>
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-muted">
              {detail.blockers.map((b, i) => (
                <li key={i}>⚠️ {b}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="text-[13px] font-bold text-ink">Actions ({detail.actions.length})</h2>
          {detail.actions.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted">Aucune action pour cette mission.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {detail.actions.map((a) => (
                <MissionActionItem key={a.id} workspaceId={workspaceId} missionId={detail.id} action={a} />
              ))}
            </ul>
          )}
        </Card>

        {detail.snapshotMetrics && (
          <Card>
            <h2 className="text-[13px] font-bold text-ink">Situation au moment de la création</h2>
            <p className="mt-1 text-[11.5px] text-muted">
              La photo de vos données utilisée pour construire cette mission — jamais recalculée rétroactivement.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {Object.entries(detail.snapshotMetrics).map(([key, field]) => (
                <li key={key} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-muted">{key}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-ink">{formatFieldValue(field)}</span>
                    <Badge tone={FIELD_STATUS_LABEL[field.status].tone}>{FIELD_STATUS_LABEL[field.status].text}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="text-[13px] font-bold text-ink">Historique</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[12px]">
            {detail.events.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-muted">
                <span>{e.detail || e.eventType}</span>
                <span className="text-faint">{new Date(e.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-[11px] text-faint">
          ProspectFlow construit et pilote un plan pour vous aider à atteindre votre objectif — il ne peut jamais
          garantir de l&apos;atteindre.
        </p>
      </div>
    </AppShell>
  );
}
