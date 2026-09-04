import Link from "next/link";

const POINTS = [
  "Sans engagement",
  "Annulation en quelques clics",
  "Données exportables",
  "Paiement sécurisé par Stripe",
  "Données protégées",
  "Support humain",
];

const DETAILS = [
  "Vos données restent les vôtres.",
  "Exportez vos données quand vous le souhaitez.",
  "Paiements traités de manière sécurisée par Stripe.",
  "Authentification sécurisée.",
  "Accès contrôlé par utilisateur.",
];

/**
 * Réassurance honnête : uniquement des engagements produit réels (aucun
 * chiffre ni logo client inventé — pas de clients à ce stade). Jamais de
 * formulation absolue ("100% sécurisé") — voir /securite pour le détail
 * technique vérifiable de ce qui est réellement en place.
 */
export function PricingTrust() {
  return (
    <div className="flex w-full flex-col items-center gap-6 rounded-3xl border border-line bg-panel px-6 py-9 text-center">
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

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-muted">
        {DETAILS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <p className="text-[12.5px] text-muted">
        Conçu pour les TPE, indépendants et équipes commerciales.{" "}
        <Link href="/securite" className="font-semibold text-accent">
          Voir le détail sécurité →
        </Link>
      </p>
    </div>
  );
}
