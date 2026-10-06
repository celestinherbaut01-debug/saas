"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import type { CommandCenterData } from "@/lib/command-center";

/**
 * `useSyncExternalStore` plutôt qu'un `useEffect` + `setState` : c'est le
 * mécanisme React prévu pour une valeur qui dépend de l'environnement
 * (ici l'horloge) et qui DOIT différer entre le rendu serveur et le client —
 * `getServerSnapshot` renvoie toujours `null`, donc le HTML serveur et la
 * première passe client concordent exactement (aucun mismatch d'hydratation,
 * même classe de bug que le <title> SVG déjà rencontré dans Analytics), et
 * la vraie date n'apparaît qu'une fois l'hydratation terminée.
 */
const noopSubscribe = () => () => {};
function getTodaySnapshot(): string {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function getServerSnapshot(): null {
  return null;
}
function useTodayLabel(): string | null {
  return useSyncExternalStore(noopSubscribe, getTodaySnapshot, getServerSnapshot);
}

/**
 * "Votre entreprise aujourd'hui" — vue d'ouverture de chaque Business OS
 * métier. Ne remplace ni le Dashboard (KPIs/historique) ni NOVA (chat) : ici,
 * uniquement des faits du jour + des actions concrètes cliquables + des
 * opportunités, tout dérivé des données réelles passées par la verticale
 * (voir lib/command-center.ts). `onNavigate` ouvre l'onglet/l'enregistrement
 * concerné — jamais un bouton qui ne fait rien.
 */
export function CommandCenter({
  data,
  onNavigate,
  entityName = "entreprise",
}: {
  data: CommandCenterData;
  onNavigate: (tab: string, detailId?: string) => void;
  entityName?: string;
}) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visibleActions = data.actions.filter((_, i) => !dismissed.has(i));
  const todayLabel = useTodayLabel();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-md)]">
      <div className="absolute inset-0 bg-[image:var(--gradient-signature)] opacity-[0.07]" aria-hidden />
      <div className="relative flex flex-col gap-5 bg-panel/95 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">Votre {entityName} aujourd&apos;hui</p>
            {todayLabel && <h2 className="mt-0.5 font-display text-xl font-extrabold capitalize text-ink">{todayLabel}</h2>}
          </div>
        </div>

        {data.today.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.today.map((fact, i) => (
              <span
                key={i}
                className="animate-fade-up rounded-xl border border-line bg-soft px-3 py-2 text-[12.5px] font-semibold text-ink"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {fact}
              </span>
            ))}
          </div>
        )}

        {visibleActions.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">À traiter maintenant</p>
            <ul className="flex flex-col gap-1.5">
              {visibleActions.map((action) => {
                const originalIndex = data.actions.indexOf(action);
                return (
                  <li key={originalIndex}>
                    <div className="group flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 text-[12.5px] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[var(--shadow-md)]">
                      <button
                        type="button"
                        onClick={() => onNavigate(action.tab, action.detailId)}
                        className="flex flex-1 items-center gap-2 text-left font-semibold text-ink"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] text-accent transition group-hover:bg-accent group-hover:text-accent-ink">
                          →
                        </span>
                        {action.text}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissed((prev) => new Set(prev).add(originalIndex))}
                        title="Marquer comme traité"
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] text-faint opacity-0 transition hover:bg-soft hover:text-ink group-hover:opacity-100"
                      >
                        ✓
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data.opportunities.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-accent/25 bg-accent/[0.04] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-accent">Opportunités</p>
            <ul className="flex flex-col gap-1.5">
              {data.opportunities.map((opp, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onNavigate(opp.tab, opp.detailId)}
                    className="text-left text-[12.5px] font-medium text-ink hover:text-accent"
                  >
                    ✦ {opp.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.today.length === 0 && visibleActions.length === 0 && data.opportunities.length === 0 && (
          <p className={cn("text-[12.5px] text-muted", data.actions.length > 0 && "italic")}>
            {data.actions.length > 0 ? "Tout est traité pour aujourd'hui. 🎉" : "Rien à signaler aujourd'hui."}
          </p>
        )}
      </div>
    </div>
  );
}
