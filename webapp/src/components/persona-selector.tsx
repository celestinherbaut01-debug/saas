"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// HONNÊTETÉ (mandat explicite) : ces chiffres sont un exemple pédagogique
// fixe, jamais une statistique réelle calculée sur un compte — d'où le
// badge "Démonstration" toujours visible à côté du chiffre, jamais en petit
// caractère discret. Ne jamais remplacer par un vrai calcul sans retirer
// clairement cette étiquette.
const PERSONAS = [
  {
    id: "web",
    label: "Agence web",
    icon: "🌐",
    stat: "12",
    statLabel: "entreprises sans site détecté",
    context: "dans un rayon de 15 km autour de votre zone",
    detail: "ProspectFlow priorise les entreprises sans présence web ou avec un site à refondre — jamais un catalogue générique de métiers.",
  },
  {
    id: "garage",
    label: "Garage",
    icon: "🔧",
    stat: "8",
    statLabel: "entreprises compatibles flotte",
    context: "activités impliquant probablement des déplacements",
    detail: "Transport, BTP, nettoyage, sécurité... ProspectFlow cible les entreprises qui utilisent probablement des véhicules, jamais le site web (non pertinent ici).",
  },
  {
    id: "restaurant",
    label: "Restaurant",
    icon: "🍽",
    stat: "3",
    statLabel: "opportunités pour remplir mercredi",
    context: "clients inactifs à réactiver ce jour-là",
    detail: "Business Twin détecte les créneaux creux réels et propose des scénarios concrets pour les remplir.",
  },
  {
    id: "realestate",
    label: "Immobilier",
    icon: "🏠",
    stat: "6",
    statLabel: "propriétaires probablement vendeurs",
    context: "signal probable, jamais garanti",
    detail: "ProspectFlow affiche honnêtement le niveau de confiance de chaque signal — jamais une donnée inventée présentée comme certaine.",
  },
] as const;

export function PersonaSelector() {
  const [activeId, setActiveId] = useState<(typeof PERSONAS)[number]["id"]>("web");
  const active = PERSONAS.find((p) => p.id === activeId) ?? PERSONAS[0];

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 text-[13px] font-semibold text-muted">Je suis…</span>
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition hover:-translate-y-0.5",
              activeId === p.id
                ? "border-transparent bg-[image:var(--gradient-signature)] text-accent-ink shadow-[var(--shadow-sm),var(--glow-accent)]"
                : "border-line bg-panel text-ink hover:border-accent/30 hover:bg-soft",
            )}
          >
            <span aria-hidden>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div
        key={active.id}
        className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel/90 p-6 text-center shadow-[var(--shadow-lg)] backdrop-blur"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-[200px] w-[360px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)" }}
        />
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-amber-fg/30 bg-amber-bg px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-fg">
          ⚠ Démonstration — exemple pédagogique, pas vos données
        </span>
        <p className="relative mt-4 font-display text-5xl font-extrabold">
          <span className="bg-[image:var(--gradient-signature)] bg-clip-text text-transparent">{active.stat}</span>
        </p>
        <p className="relative mt-1.5 text-[15px] font-bold text-ink">{active.statLabel}</p>
        <p className="relative mt-1 text-[12px] text-faint">{active.context}</p>
        <p className="relative mt-4 text-[12.5px] leading-relaxed text-muted">{active.detail}</p>
      </div>
    </div>
  );
}
