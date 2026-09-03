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
