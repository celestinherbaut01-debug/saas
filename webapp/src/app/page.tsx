import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PricingTrust } from "@/components/pricing-trust";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Plus de redirection automatique et invisible : "/" reste toujours la
  // landing, même pour un utilisateur déjà connecté. C'est "/login" qui
  // propose explicitement de continuer vers son espace (voir SessionGate).
  const ctaHref = user ? "/login" : "/signup";
  const ctaLabel = user ? "Accéder à mon espace" : "Essayer gratuitement";

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden">
      <PublicNav />

      <main className="flex flex-col items-center gap-28 px-6 pb-28">
        {/* HERO */}
        <section className="relative flex w-full max-w-5xl flex-col items-center gap-7 pt-20 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)" }}
          />
          <span className="relative rounded-full border border-line bg-panel/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent shadow-[var(--shadow-sm)] backdrop-blur">
            Business Twin · Acquisition · Studio · Business OS
          </span>
          <h1 className="relative max-w-3xl text-balance font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            ProspectFlow comprend votre activité{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">avant</span> de vous
            proposer quoi que ce soit.
          </h1>
          <p className="relative max-w-xl text-pretty text-[15px] leading-relaxed text-muted">
            Un objectif, une vraie analyse de vos données, des opportunités expliquées — jamais devinées — et des
            actions prêtes à exécuter. Chaque entreprise affichée est vérifiée (registre officiel français + Google)
            avant d&apos;être montrée.
          </p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link href={ctaHref} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg shadow-[var(--shadow-md)] transition hover:-translate-y-0.5">
              {ctaLabel}
            </Link>
            <Link
              href="/tarifs"
              className="rounded-lg border border-line bg-panel px-5 py-2.5 text-sm font-semibold text-ink shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5"
            >
              Voir les tarifs
            </Link>
          </div>

          <Reveal delay={150} className="relative mt-6 w-full max-w-3xl">
            <HeroMockup />
          </Reveal>
        </section>

        {/* FLUX OBJECTIF -> RESULTAT */}
        <Reveal className="w-full max-w-5xl">
          <h2 className="text-center font-display text-2xl font-extrabold">De l&apos;objectif au résultat, sans étape devinée</h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-5">
            {[
              { icon: "🎯", label: "Objectif" },
              { icon: "🔍", label: "Analyse" },
              { icon: "💡", label: "Opportunité" },
              { icon: "⚡", label: "Action" },
              { icon: "📈", label: "Résultat" },
            ].map((step, i, arr) => (
              <Reveal key={step.label} delay={i * 90} className="relative flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-panel text-xl shadow-[var(--shadow-sm)]">
                  {step.icon}
                </div>
                <p className="text-[12.5px] font-bold">{step.label}</p>
                {i < arr.length - 1 && (
                  <span className="pointer-events-none absolute right-[-14px] top-7 hidden text-line sm:block" aria-hidden>
                    →
                  </span>
                )}
              </Reveal>
            ))}
          </div>
        </Reveal>

        {/* 4 PILIERS */}
        <Reveal className="w-full max-w-5xl">
          <h2 className="text-center font-display text-2xl font-extrabold">Un seul produit, quatre piliers</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PillarCard icon="🧭" title="Business Twin" text="Comprendre votre situation réelle et décider quel objectif poursuivre, avec des scénarios comparés honnêtement." />
            <PillarCard icon="⌕" title="Acquisition" text="Trouver les bonnes opportunités selon ce que vous vendez réellement — jamais un catalogue générique de cibles." />
            <PillarCard icon="🎨" title="Studio" text="Transformer une offre — produit, bien, réalisation, événement — en contenu prêt à publier sur chaque canal." />
            <PillarCard icon="▣" title="Business OS" text="Gérer votre activité au quotidien avec un vocabulaire et des modules adaptés à votre métier." />
          </div>
        </Reveal>

        <Reveal className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
          <h2 className="font-display text-2xl font-extrabold">Le problème</h2>
          <p className="max-w-xl text-[14px] leading-relaxed text-muted">
            Trouver des prospects pertinents prend des heures — recherches manuelles, listes achetées
            périmées, entreprises fermées ou hors cible. ProspectFlow automatise la partie fastidieuse et
            garde la partie humaine (le contact) entre vos mains.
          </p>
        </Reveal>

        <Reveal className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          <FeatureCard
            title="Prospection vérifiée"
            text="Registre officiel des entreprises (SIRENE) + Google Places en enrichissement optionnel. Distance, statut et indépendance réels, jamais devinés."
          />
          <FeatureCard
            title="CRM avec score expliqué"
            text="Chaque prospect a un score d'opportunité détaillé — proximité, secteur, présence web — jamais une note opaque."
          />
          <FeatureCard
            title="NOVA, l'agent commercial"
            text="Répond avec vos vraies données (CRM, activité) et rédige des emails personnalisés à valider avant envoi."
          />
        </Reveal>

        <Reveal className="w-full max-w-4xl">
          <h2 className="text-center font-display text-2xl font-extrabold">Comment ça marche</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-4">
            <Step n={1} title="Votre activité" text="Métier, offre et clientèle cible en quelques questions." />
            <Step n={2} title="Votre zone" text="Position précise (GPS ou adresse) et rayon de prospection." />
            <Step n={3} title="Prospects vérifiés" text="Des entreprises réelles, scorées par pertinence." />
            <Step n={4} title="CRM + NOVA" text="Suivez chaque contact, laissez NOVA préparer vos emails." />
          </div>
        </Reveal>

        <Reveal className="w-full max-w-3xl rounded-2xl border border-line bg-panel p-8 text-center shadow-[var(--shadow-sm)]">
          <h2 className="font-display text-xl font-extrabold">Business OS</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Sur les plans Pro et Max, ProspectFlow devient aussi le logiciel de gestion de votre métier —
            clients, stock, planning — avec un vocabulaire et des modules adaptés (garage, salon, restaurant,
            nettoyage, sécurité, agence web...). Un seul outil pour prospecter et gérer.
          </p>
        </Reveal>

        <Reveal className="w-full max-w-3xl">
          <h2 className="text-center font-display text-xl font-extrabold">Questions fréquentes</h2>
          <div className="mt-6 flex flex-col gap-4">
            <Faq
              q="Les prospects affichés sont-ils réels ?"
              a="Oui, toujours. Chaque entreprise vient du registre officiel français (SIRENE). Si une information n'est pas vérifiée, ProspectFlow l'affiche comme « à vérifier » plutôt que de l'inventer."
            />
            <Faq
              q="Dois-je payer pour essayer ?"
              a="Non. Le plan Free permet de tester ProspectFlow sans carte bancaire, avec un volume volontairement limité."
            />
            <Faq
              q="NOVA et Studio utilisent-ils une IA générative ?"
              a="Le contenu généré aujourd'hui est déterministe — composé à partir de vos vraies données, jamais inventé — et non issu d'un modèle génératif tiers. L'architecture est prête pour en connecter un, sans changer ce principe : rien n'est jamais présenté comme généré par IA si ce n'est pas le cas."
            />
          </div>
        </Reveal>

        <Reveal className="w-full max-w-4xl">
          <PricingTrust />
        </Reveal>

        <Reveal className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-10 text-center shadow-[var(--shadow-md)]">
          <h2 className="font-display text-xl font-extrabold">Prêt à trouver vos prochains clients ?</h2>
          <p className="text-[13px] text-muted">Gratuit pour démarrer, aucune carte requise.</p>
          <Link href={ctaHref} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5">
            {user ? "Accéder à mon espace" : "Créer mon compte"}
          </Link>
        </Reveal>
      </main>
    </div>
  );
}

/**
 * Diagramme illustratif en HTML/CSS — jamais une capture d'écran du vrai
 * produit présentée comme telle : une représentation stylisée de ce que
 * fait ProspectFlow, clairement composée de blocs génériques (aucune
 * donnée, aucun nom d'entreprise réel).
 */
function HeroMockup() {
  return (
    <div className="relative rounded-2xl border border-line bg-panel/90 p-4 shadow-[var(--shadow-lg)] backdrop-blur">
      <div className="flex items-center gap-1.5 border-b border-line pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-fg/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-fg/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-fg/60" />
        <span className="ml-3 text-[10.5px] font-semibold text-faint">Business Twin — Objectif</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent">Objectif</p>
          <p className="mt-1 text-[12.5px] font-semibold">Remplir les créneaux du jeudi</p>
        </div>
        <div className="rounded-xl border border-line bg-soft p-3.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-wide text-faint">Scénario recommandé</p>
          <p className="mt-1 text-[12.5px] font-semibold">Réactiver 24 clients inactifs</p>
          <p className="mt-1 text-[10.5px] text-faint">Confiance élevée</p>
        </div>
        <div className="rounded-xl border border-line bg-soft p-3.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-wide text-faint">Action prête</p>
          <p className="mt-1 text-[12.5px] font-semibold">Campagne SMS préparée</p>
          <p className="mt-1 text-[10.5px] text-faint">À valider avant envoi</p>
        </div>
      </div>
    </div>
  );
}

function PillarCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-5 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-[15px] text-white">
        {icon}
      </span>
      <h3 className={cn("font-display text-[14px] font-bold")}>{title}</h3>
      <p className="text-[12.5px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5 text-left shadow-[var(--shadow-sm)]">
      <h3 className="font-display text-[14px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ink to-ink/80 font-display text-[13px] font-extrabold text-bg shadow-[var(--shadow-sm)]">
        {n}
      </div>
      <h3 className="font-display text-[13px] font-bold">{title}</h3>
      <p className="text-[12px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[13px] font-bold">{q}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{a}</p>
    </div>
  );
}
