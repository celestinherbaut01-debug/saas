const EXAMPLES = [
  { icon: "🔧", name: "Garage", detail: "véhicules, atelier, pièces, planning" },
  { icon: "🧹", name: "Nettoyage", detail: "contrats, interventions, équipes" },
  { icon: "💻", name: "Agence", detail: "projets, sites, maintenance" },
  { icon: "🍽", name: "Restaurant", detail: "stocks, fournisseurs, coûts" },
];

export function PricingBusinessOs() {
  return (
    <div className="flex w-full flex-col items-center gap-8 rounded-3xl border border-line bg-panel px-6 py-12 sm:px-10">
      <div className="flex max-w-lg flex-col items-center gap-3 text-center">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Bien plus qu&apos;un outil de prospection.</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Avec le module Business OS, ProspectFlow devient également votre logiciel de gestion — des modules
          réellement adaptés à votre métier (véhicules et ordres de réparation pour un garage, contrats de
          site pour le nettoyage, projets pour une agence...), pas un simple CRM relabellé. Indépendant du
          module Acquisition : activez-le seul, ou combinez les deux à prix réduit.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLES.map((ex) => (
          <div
            key={ex.name}
            className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-soft px-4 py-6 text-center transition-transform hover:-translate-y-0.5"
          >
            <span className="text-2xl">{ex.icon}</span>
            <span className="font-display text-[13.5px] font-extrabold">{ex.name}</span>
            <span className="text-[11.5px] leading-relaxed text-muted">{ex.detail}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="flex items-center gap-2 rounded-full border border-line bg-bg px-4 py-2 text-[12px] font-semibold">
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-bg">STANDARD</span>
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
