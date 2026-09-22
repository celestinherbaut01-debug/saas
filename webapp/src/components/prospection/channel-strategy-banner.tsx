import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChannelStrategy } from "@/lib/prospecting/channel-strategy";

/**
 * Affiche honnêtement si le registre d'entreprises (SIRENE) est le bon canal
 * pour l'offre déclarée — voir lib/prospecting/channel-strategy.ts. Pour
 * "b2c_not_registry", ne masque jamais la recherche B2B (certains cas
 * limites existent : un agent immobilier gère parfois aussi du commercial),
 * mais la replie par défaut derrière un choix explicite plutôt que de la
 * présenter comme le parcours principal.
 */
export function ChannelStrategyBanner({ strategy }: { strategy: ChannelStrategy }) {
  if (strategy.channel === "b2b_registry_search") return null;

  const isBlocking = strategy.channel === "b2c_not_registry";

  return (
    <Card className={cn(isBlocking ? "border-amber-fg/30 bg-amber-bg/40" : "border-accent/30 bg-accent/5")}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-lg">{isBlocking ? "💡" : "ℹ️"}</span>
        <div>
          <p className="font-display text-[13.5px] font-extrabold">{strategy.headline}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{strategy.explanation}</p>

          {strategy.alternatives.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">
                {isBlocking ? "Ce qui fonctionne réellement pour votre clientèle" : "Pour compléter, côté particuliers"}
              </p>
              <ul className="flex flex-col gap-1.5">
                {strategy.alternatives.map((alt) => (
                  <li key={alt.label} className="text-[12px] leading-relaxed">
                    <span className="font-semibold text-ink">{alt.label}</span>
                    <span className="text-muted"> — {alt.description}</span>
                  </li>
                ))}
              </ul>
              <Link href="/dashboard" className="mt-1 text-[12px] font-semibold text-accent">
                Voir ces objectifs dans Business Twin →
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
