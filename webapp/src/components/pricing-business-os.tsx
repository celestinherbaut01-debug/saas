// Exemples de workflows métier déjà construits — PAS une liste fermée des
// métiers couverts. Voir l'audit /tarifs : présenter uniquement ces 4 (puis
// 5) verticales donnait l'impression fausse que ProspectFlow se limite à
// elles, et Immobilier (construit en V4) manquait de ce bloc. Icônes
// monochromes cohérentes avec le design V4 (plus d'emoji couleur) ; ⌂ reprend
// l'icône déjà utilisée pour Immobilier ailleurs dans l'app (business-os.ts).
const EXAMPLES = [
  { icon: "⚙", name: "Garage", detail: "véhicules, atelier, pièces, planning" },
  { icon: "◈", name: "Agence web", detail: "projets, sites, maintenance" },
  { icon: "✧", name: "Nettoyage", detail: "contrats, interventions, équipes" },
  { icon: "◎", name: "Restaurant", detail: "stocks, fournisseurs, coûts" },
  { icon: "⌂", name: "Immobilier", detail: "biens, mandats, visites, offres" },
];

export function PricingBusinessOs() {
  return (
    <div className="flex w-full flex-col items-center gap-8 rounded-3xl border border-line bg-panel px-6 py-12 sm:px-10">
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Un Business OS qui s&apos;adapte à votre activité</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Avec le module Business OS, ProspectFlow devient également votre logiciel de gestion — des workflows
          réellement adaptés à votre métier, pas un simple CRM relabellé. Indépendant du module Acquisition :
          activez-le seul, ou combinez les deux à prix réduit.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Exemples de workflows déjà construits</p>
        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {EXAMPLES.map((ex) => (
            <div
              key={ex.name}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-soft px-4 py-6 text-center transition-transform hover:-translate-y-0.5"
            >
              <span aria-hidden className="text-2xl font-semibold text-accent">{ex.icon}</span>
              <span className="font-display text-[13.5px] font-extrabold">{ex.name}</span>
              <span className="text-[11.5px] leading-relaxed text-muted">{ex.detail}</span>
            </div>
          ))}
        </div>
        <p className="max-w-lg text-center text-[12px] leading-relaxed text-faint">
          Cette liste n&apos;est pas exhaustive. Pour les autres métiers, l&apos;espace Business OS reste
          disponible et s&apos;adapte (clients, planning, suivi) — sans workflow spécialisé pré-construit pour
          l&apos;instant.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="flex items-center gap-2 rounded-full border border-line bg-bg px-4 py-2 text-[12px] font-semibold">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">STANDARD</span>
          Business OS
        </span>
        <span className="flex items-center gap-2 rounded-full border border-accent/40 bg-bg px-4 py-2 text-[12px] font-semibold">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">ADVANCED</span>
          Business OS Advanced
        </span>
      </div>
    </div>
  );
}
