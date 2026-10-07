"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

// Bandeau discret, une ligne — jamais un hero de landing page. L'utilisateur
// doit voir ses données/actions tout de suite sur une page applicative, pas
// une grande bannière marketing à chaque connexion (voir .pf-intro dans
// globals.css pour le style compact correspondant).
const AREAS: Record<string, { name: string; detail: string; cta: string; href: string }> = {
  "/dashboard": { name: "Vue d'ensemble", detail: "L'activité commerciale et les rendez-vous réunis pour garder le cap.", cta: "Ouvrir mon entreprise", href: "/business-os" },
  "/business-os": { name: "Opérations", detail: "Du premier client à la prestation terminée, chaque étape a sa place.", cta: "Voir les missions", href: "/missions" },
  "/crm": { name: "Relation client", detail: "Priorisez les relances. Transformez les opportunités en clients.", cta: "Trouver des prospects", href: "/prospection" },
  "/analytics": { name: "Performance", detail: "Votre activité mesurée à partir des résultats enregistrés.", cta: "Voir le pipeline", href: "/crm" },
  "/missions": { name: "Exécution", detail: "Avancez sur les objectifs de votre entreprise, étape après étape.", cta: "Explorer NOVA", href: "/nova/actions" },
  "/nova": { name: "Intelligence", detail: "Des opportunités expliquées, reliées à votre activité.", cta: "Voir les missions", href: "/missions" },
  "/studio": { name: "Communication", detail: "Vos informations deviennent des contenus adaptés à chaque canal.", cta: "Voir mon entreprise", href: "/business-os" },
  "/prospection": { name: "Acquisition", detail: "Construisez une sélection d'entreprises adaptée à votre offre.", cta: "Ouvrir le CRM", href: "/crm" },
  "/abonnement": { name: "Votre espace", detail: "Acquisition, opérations ou les deux : choisissez ce dont vous avez besoin.", cta: "Comparer les tarifs", href: "/tarifs" },
};

export function WorkspaceIntro() {
  const path = usePathname();
  const area = AREAS["/" + path.split("/")[1]];
  if (!area || path.split("/").length > 3) return null;
  return (
    <section className="pf-intro">
      <div className="pf-intro-copy">
        <p className="pf-eyebrow">{area.name}</p>
        <p>{area.detail}</p>
      </div>
      <Link href={area.href}>
        {area.cta} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
