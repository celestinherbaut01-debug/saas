import { PublicNav } from "@/components/public-nav";

interface Section {
  title: string;
  status: "live" | "partial" | "planned";
  text: string;
}

const SECTIONS: Section[] = [
  {
    title: "Authentification",
    status: "live",
    text:
      "Connexion par Google (OAuth) ou email/mot de passe, gérée par Supabase Auth. Les sessions passent par des cookies httpOnly gérés côté serveur (@supabase/ssr) — le jeton de session n'est jamais exposé au JavaScript de la page.",
  },
  {
    title: "Isolation des données (Row Level Security)",
    status: "live",
    text:
      "Chaque table métier (prospects, clients, factures, workspace…) est protégée par des policies PostgreSQL Row Level Security : une requête ne peut jamais retourner ou modifier une ligne appartenant à un autre workspace que celui de l'utilisateur connecté. Ce n'est pas une vérification applicative qu'on pourrait contourner — c'est appliqué par la base de données elle-même, sur chaque requête.",
  },
  {
    title: "Accès contrôlé par utilisateur",
    status: "live",
    text:
      "L'appartenance à un workspace (table workspace_members) conditionne l'accès à ses données. Un rôle (owner/membre) est enregistré par utilisateur ; la gestion fine des permissions par rôle est encore limitée (voir « à venir »).",
  },
  {
    title: "Paiements — Stripe",
    status: "planned",
    text:
      "Le changement de forfait payant n'est pas encore branché à un moyen de paiement réel : l'intégration Stripe Checkout / Customer Portal / webhooks est prévue mais pas encore en place dans ce projet. Aucune carte bancaire n'est demandée aujourd'hui. Une fois branché, les paiements seront traités par Stripe — jamais stocké de numéro de carte sur nos serveurs.",
  },
  {
    title: "Export de vos données",
    status: "planned",
    text:
      "Un export en libre-service (CSV/JSON) depuis l'interface n'est pas encore disponible. En attendant, un export de vos données sur simple demande est possible manuellement depuis la base. Vos données vous appartiennent : ce n'est pas une fonctionnalité qu'on facture ni qu'on limite.",
  },
  {
    title: "Suppression de compte",
    status: "planned",
    text:
      "La suppression de compte en libre-service depuis Paramètres n'est pas encore implémentée. Une demande de suppression traitée manuellement est possible dès aujourd'hui — écrivez-nous.",
  },
  {
    title: "Confidentialité",
    status: "live",
    text:
      "Vos données de prospection et de CRM ne sont ni revendues ni partagées avec d'autres clients — l'isolation par Row Level Security (ci-dessus) le garantit techniquement, pas seulement contractuellement. Les entreprises affichées en prospection viennent de sources publiques (registre SIRENE, Google Places) : ce ne sont pas des données personnelles que nous collectons sur vous.",
  },
  {
    title: "Sauvegardes",
    status: "partial",
    text:
      "La base de données est hébergée par Supabase, qui applique ses propres politiques de sauvegarde selon le plan du projet — nous n'avons pas encore documenté publiquement la fréquence et la rétention exactes de ce projet précis. À préciser avant une mise en production commerciale plutôt que d'affirmer un chiffre non vérifié.",
  },
  {
    title: "Hébergement",
    status: "live",
    text:
      "Application web hébergée sur Netlify. Base de données, authentification et fonctions serveur (recherche de prospects) hébergées sur Supabase (PostgreSQL managé). Aucune donnée n'est hébergée sur un serveur personnel.",
  },
];

const STATUS_LABEL: Record<Section["status"], { text: string; cls: string }> = {
  live: { text: "En place", cls: "bg-green-bg text-green-fg" },
  partial: { text: "Partiel — à préciser", cls: "bg-amber-bg text-amber-fg" },
  planned: { text: "Pas encore branché", cls: "bg-soft text-muted" },
};

export default function SecuritePage() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-4 text-center">
          <h1 className="font-display text-[28px] font-extrabold tracking-tight sm:text-[34px]">
            Sécurité & confidentialité
          </h1>
          <p className="text-[14.5px] leading-relaxed text-muted">
            Un état honnête de ce qui est réellement en place aujourd&apos;hui — pas une liste de
            promesses. Ce qui n&apos;est pas encore branché est marqué comme tel, pas présenté comme
            fonctionnel. Nous n&apos;avons aucune certification (SOC 2, ISO 27001) à ce stade et ne
            prétendons pas en avoir.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((s) => {
            const status = STATUS_LABEL[s.status];
            return (
              <div key={s.title} className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-[14.5px] font-bold">{s.title}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.cls}`}>
                    {status.text}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.text}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-dashed border-line bg-soft p-5 text-center">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Une question de sécurité précise sur votre cas d&apos;usage (RGPD, sous-traitance, DPA) ?
            Contactez-nous avant de vous engager — nous préférons répondre honnêtement plutôt que de
            deviner.
          </p>
        </div>
      </main>
    </div>
  );
}
