import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <PublicNav />

      <main className="flex flex-col items-center gap-24 px-6 pb-24">
        <section className="flex flex-col items-center gap-6 pt-20 text-center">
          <h1 className="max-w-2xl text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            ProspectFlow trouve vos prochains clients et vous aide à les convertir.
          </h1>
          <p className="max-w-lg text-pretty text-[15px] leading-relaxed text-muted">
            Chaque entreprise affichée est vérifiée (registre officiel français + Google) avant
            d&apos;être montrée. Aucun prospect fictif, aucune donnée inventée — jamais.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
              Essayer gratuitement
            </Link>
            <Link
              href="/tarifs"
              className="rounded-lg border border-line bg-panel px-5 py-2.5 text-sm font-semibold text-ink"
            >
              Voir les tarifs
            </Link>
          </div>
        </section>

        <section className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
          <h2 className="font-display text-2xl font-extrabold">Le problème</h2>
          <p className="max-w-xl text-[14px] leading-relaxed text-muted">
            Trouver des prospects pertinents prend des heures — recherches manuelles, listes achetées
            périmées, entreprises fermées ou hors cible. ProspectFlow automatise la partie fastidieuse et
            garde la partie humaine (le contact) entre vos mains.
          </p>
        </section>

        <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
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
        </section>

        <section className="w-full max-w-4xl">
          <h2 className="text-center font-display text-2xl font-extrabold">Comment ça marche</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-4">
            <Step n={1} title="Votre activité" text="Métier, offre et clientèle cible en quelques questions." />
            <Step n={2} title="Votre zone" text="Position précise (GPS ou adresse) et rayon de prospection." />
            <Step n={3} title="Prospects vérifiés" text="Des entreprises réelles, scorées par pertinence." />
            <Step n={4} title="CRM + NOVA" text="Suivez chaque contact, laissez NOVA préparer vos emails." />
          </div>
        </section>

        <section className="w-full max-w-3xl rounded-2xl border border-line bg-panel p-8 text-center">
          <h2 className="font-display text-xl font-extrabold">Business OS</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Sur les plans Pro et Max, ProspectFlow devient aussi le logiciel de gestion de votre métier —
            clients, stock, planning — avec un vocabulaire et des modules adaptés (garage, salon, restaurant,
            nettoyage, sécurité, agence web...). Un seul outil pour prospecter et gérer.
          </p>
        </section>

        <section className="w-full max-w-3xl">
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
              q="NOVA envoie-t-il des emails tout seul ?"
              a="Non. NOVA rédige des brouillons personnalisés que vous relisez et validez avant tout envoi — aucun envoi automatique n'existe à ce jour."
            />
          </div>
        </section>

        <section className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-10 text-center">
          <h2 className="font-display text-xl font-extrabold">Prêt à trouver vos prochains clients ?</h2>
          <p className="text-[13px] text-muted">Gratuit pour démarrer, aucune carte requise.</p>
          <Link href="/signup" className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
            Créer mon compte
          </Link>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5 text-left">
      <h3 className="font-display text-[14px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-[13px] font-extrabold text-bg">
        {n}
      </div>
      <h3 className="font-display text-[13px] font-bold">{title}</h3>
      <p className="text-[12px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[13px] font-bold">{q}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{a}</p>
    </div>
  );
}
