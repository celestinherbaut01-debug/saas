import { getCachedUser, getCachedMembership } from "@/lib/session";
import { getWorkspacePlan } from "@/lib/plan";
import { PublicNav } from "@/components/public-nav";
import { PricingTable } from "@/components/pricing-table";
import { PricingTrust } from "@/components/pricing-trust";
import { PricingBusinessOs } from "@/components/pricing-business-os";

export default async function TarifsPage() {
  // Connecté ou non, /tarifs reste accessible (page publique) — mais un
  // utilisateur connecté peut changer de forfait directement ici, sans
  // passer par /abonnement (voir PricingTable : mêmes actions serveur que
  // la page Abonnement, juste exposées directement sur chaque carte).
  const user = await getCachedUser();
  const membership = user ? await getCachedMembership(user.id) : null;
  const currentPlan = membership ? await getWorkspacePlan(membership.workspace_id) : null;

  return (
    <div className="flex flex-1 flex-col">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-6xl flex-col items-center gap-16 px-6 py-16 sm:py-20">
        <div className="flex max-w-xl flex-col items-center gap-4 text-center">
          <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-tight sm:text-[40px]">
            Un plan pour chaque étape de votre croissance.
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Commencez gratuitement. Passez à une offre supérieure lorsque vous avez besoin de plus de
            prospects, d&apos;automatisation et de gestion.
          </p>
        </div>

        <section className="grid w-full gap-6 rounded-3xl bg-sidebar p-8 text-white lg:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">01 / ACQUISITION</p><h2 className="mt-3 text-xl font-bold">Trouver et gagner des clients</h2><p className="mt-2 text-sm text-slate-300">Prospection → CRM → rendez-vous → affaire gagnée.</p></div><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">02 / BUSINESS OS</p><h2 className="mt-3 text-xl font-bold">Réaliser et gérer l’activité</h2><p className="mt-2 text-sm text-slate-300">Client → workflow métier → prestation → suivi.</p></div><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">03 / COMPLETE</p><h2 className="mt-3 text-xl font-bold">Relier les deux</h2><p className="mt-2 text-sm text-slate-300">Un prospect gagné devient un client. NOVA et les missions exploitent les données de votre activité.</p></div></section>
        <PricingTable
          loggedIn={Boolean(user)}
          workspaceId={membership?.workspace_id}
          currentPlan={currentPlan ?? undefined}
          isDev={process.env.NODE_ENV !== "production"}
        />
        <PricingTrust />
        <PricingBusinessOs />
      </main>
    </div>
  );
}
