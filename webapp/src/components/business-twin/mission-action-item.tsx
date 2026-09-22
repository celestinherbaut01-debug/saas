"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setMissionActionStatus } from "@/lib/actions/business-twin";
import type { MissionActionView } from "@/lib/actions/business-twin";

/** Construit le lien de préremplissage Studio IA à partir du contenu déjà préparé par le plan (voir generateCampaignTemplate) — jamais de nouveau texte inventé ici. */
function studioPrefillHref(missionId: string, action: MissionActionView): string {
  const content = action.preparedContent ?? {};
  const title = typeof content.headline === "string" ? content.headline : action.title;
  const description = typeof content.offerPrompt === "string" ? content.offerPrompt : "";
  const params = new URLSearchParams({ new: "1", offerType: "promotion", title, description, sourceMissionId: missionId });
  return `/studio?${params.toString()}`;
}

const STATUS_LABEL: Record<string, { text: string; tone: BadgeTone }> = {
  proposed: { text: "Proposée", tone: "neutral" },
  ready: { text: "Prête", tone: "accent" },
  done: { text: "Faite", tone: "success" },
  skipped: { text: "Ignorée", tone: "neutral" },
};

/** Contenu préparé (voir prepared_content) — jamais envoyé automatiquement, seulement affiché pour copier/adapter. */
function PreparedContent({ content }: { content: Record<string, unknown> }) {
  const entries = Object.entries(content).filter(([, v]) => typeof v === "string" && v.length > 0);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-line bg-bg p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-faint">{key}</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-ink">{String(value)}</pre>
        </div>
      ))}
    </div>
  );
}

export function MissionActionItem({ workspaceId, missionId, action }: { workspaceId: string; missionId: string; action: MissionActionView }) {
  const [status, setStatus] = useState(action.status);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  function update(next: "done" | "skipped") {
    startTransition(async () => {
      const result = await setMissionActionStatus(workspaceId, action.id, next);
      if (!("error" in result)) setStatus(next);
    });
  }

  return (
    <li className="rounded-lg border border-line bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">{action.title}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">{action.reason}</p>
        </div>
        <Badge tone={STATUS_LABEL[status]?.tone ?? "neutral"}>{STATUS_LABEL[status]?.text ?? status}</Badge>
      </div>

      {action.preparedContent && (
        <>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[11.5px] font-semibold text-accent">
            {expanded ? "Masquer le contenu préparé" : "Voir le contenu préparé"}
          </button>
          {expanded && <PreparedContent content={action.preparedContent} />}
        </>
      )}

      {action.actionType === "campagne" && (
        <Link href={studioPrefillHref(missionId, action)} className="mt-2 inline-block text-[11.5px] font-semibold text-accent">
          🎨 Créer cette campagne dans Studio IA →
        </Link>
      )}

      {status !== "done" && status !== "skipped" && (
        <div className="mt-2.5 flex items-center gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => update("done")}>
            Fait
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => update("skipped")}>
            Ignorer
          </Button>
        </div>
      )}
    </li>
  );
}
