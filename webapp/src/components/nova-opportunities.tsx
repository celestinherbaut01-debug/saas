"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { setOpportunityStatus } from "@/lib/actions/nova-opportunities";
import type { Opportunity, OpportunityPriority } from "@/lib/nova-opportunities";

const PRIORITY_LABEL: Record<OpportunityPriority, { text: string; tone: BadgeTone }> = {
  high: { text: "Priorité haute", tone: "danger" },
  medium: { text: "Priorité moyenne", tone: "warning" },
  low: { text: "Priorité basse", tone: "neutral" },
};

/**
 * Bloc "Opportunités détectées par NOVA" — le point d'entrée du NOVA Growth
 * Autopilot, pensé pour être une des premières choses visibles à l'ouverture
 * du Dashboard/Business OS (voir item 15 de la refonte pricing). Chaque
 * carte vient de lib/nova-opportunities.ts (100% déterministe, aucune IA
 * générative requise) : jamais un chiffre de CA/ROI/conversion inventé, un
 * `impact` toujours qualitatif, une `reason` toujours dérivée de vraies
 * données.
 *
 * "Fait"/"Ignorer" appelle setOpportunityStatus (nova_action_log) — un
 * snooze de 24h, pas une suppression : la carte disparaît localement tout de
 * suite (optimiste) ET la page se revalide côté serveur (revalidatePath),
 * donc un nouveau signal du même type pourra réapparaître plus tard.
 */
export function NovaOpportunities({
  workspaceId,
  opportunities,
  actionCenterHref,
  title,
  hideFooterNote,
}: {
  workspaceId: string;
  opportunities: Opportunity[];
  /** Présent seulement si le plan inclut le centre d'actions complet (Complete Max) — sinon pas de lien "Voir tout". */
  actionCenterHref?: string;
  /** Remplace le titre par défaut ("J'ai détecté N opportunités aujourd'hui") — utile pour les sous-sections du centre d'actions, qui ont déjà leur propre titre de section. */
  title?: string;
  /** Masque le rappel "jamais de chiffre inventé" — pour éviter de le répéter à chaque sous-section d'une même page. */
  hideFooterNote?: boolean;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = opportunities.filter((o) => !hiddenKeys.has(o.key));
  if (visible.length === 0) return null;

  function handleStatus(key: string, status: "done" | "dismissed") {
    setPendingKey(key);
    setError(null);
    startTransition(async () => {
      const result = await setOpportunityStatus(workspaceId, key, status);
      setPendingKey(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHiddenKeys((prev) => new Set(prev).add(key));
    });
  }

  return (
    <Card className="border-accent/25 bg-gradient-to-br from-panel to-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px]">✦</span>
          <h2 className="text-[13px] font-bold text-ink">
            {title ?? `NOVA — J'ai détecté ${visible.length} opportunité${visible.length > 1 ? "s" : ""} aujourd'hui`}
          </h2>
        </div>
        {actionCenterHref && (
          <Link href={actionCenterHref} className="text-[11.5px] font-semibold text-accent hover:underline">
            Voir toutes les opportunités →
          </Link>
        )}
      </div>

      {error && <p className="mt-2 text-[11.5px] font-medium text-red-fg">{error}</p>}

      <ul className="mt-3 flex flex-col gap-2.5">
        {visible.map((o) => (
          <li key={o.key} className="rounded-lg border border-line bg-bg px-3.5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="text-[16px] leading-none">{o.icon}</span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{o.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted">{o.reason}</p>
                  <p className="mt-1 text-[10.5px] text-faint">{o.impact}</p>
                </div>
              </div>
              <Badge tone={PRIORITY_LABEL[o.priority].tone}>{PRIORITY_LABEL[o.priority].text}</Badge>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">{o.source}</span>
              <div className="flex items-center gap-2">
                {o.dismissible && (
                  <button
                    type="button"
                    disabled={pending && pendingKey === o.key}
                    onClick={() => handleStatus(o.key, "dismissed")}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-faint hover:bg-soft"
                  >
                    Ignorer
                  </button>
                )}
                <Link
                  href={o.actionHref}
                  onClick={() => o.dismissible && handleStatus(o.key, "done")}
                  className={cn(
                    "rounded-lg bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-bg hover:opacity-90",
                    pending && pendingKey === o.key && "opacity-60",
                  )}
                >
                  {o.actionLabel}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!hideFooterNote && (
        <p className="mt-3 text-[10.5px] text-faint">
          Calculé en direct depuis vos vraies données — jamais un chiffre de chiffre d&apos;affaires ou de taux de
          conversion inventé.
        </p>
      )}
    </Card>
  );
}
