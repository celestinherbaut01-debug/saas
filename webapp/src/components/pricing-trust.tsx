const POINTS = [
  "Sans engagement",
  "Annulation en quelques clics",
  "Données exportables",
  "Paiement sécurisé",
  "Support humain",
];

/**
 * Réassurance honnête : uniquement des engagements produit réels (aucun
 * chiffre ni logo client inventé — pas de clients à ce stade).
 */
export function PricingTrust() {
  return (
    <div className="flex w-full flex-col items-center gap-5 rounded-3xl border border-line bg-panel px-6 py-9 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {POINTS.map((p) => (
          <span key={p} className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-bg text-[9px] font-bold text-green-fg">
              ✓
            </span>
            {p}
          </span>
        ))}
      </div>
      <p className="text-[12.5px] text-muted">Conçu pour les TPE, indépendants et équipes commerciales.</p>
    </div>
  );
}
