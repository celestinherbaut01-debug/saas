import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership, getCachedBusinessProfile } from "@/lib/session";
import { getWorkspacePlan } from "@/lib/plan";
import { NavLink } from "@/components/nav-link";
import { NavSection } from "@/components/nav-section";
import { ProfileMenu } from "@/components/profile-menu";
import { ENTITLEMENTS, upgradeOptions, businessOsAtLeast, type Plan } from "@/lib/entitlements";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // Primitives mémorisées par requête : si la page qui a rendu <AppShell>
  // a déjà appelé getCachedUser()/getCachedMembership() (c'est le cas de
  // toutes les pages protégées), ces appels ne refont AUCUN aller-retour
  // réseau — voir lib/session.ts et lib/plan.ts pour le détail.
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);

  const supabase = await createClient();
  const [{ data: workspace }, plan, businessProfile] = await Promise.all([
    membership
      ? supabase.from("workspaces").select("name").eq("id", membership.workspace_id).maybeSingle()
      : Promise.resolve({ data: null }),
    membership ? getWorkspacePlan(membership.workspace_id) : Promise.resolve<Plan>("free"),
    membership ? getCachedBusinessProfile(membership.workspace_id) : Promise.resolve(null),
  ]);
  const entitlements = ENTITLEMENTS[plan];
  // Le module le moins cher qui AJOUTE quelque chose sans rien retirer —
  // jamais un simple "plan suivant" dans une liste, qui suggérerait à tort
  // par ex. de passer d'Acquisition Pro à Business OS (perdrait Acquisition
  // entière) ou de Business OS Advanced à Complete (repasserait le Business
  // OS en standard). Voir upgradeOptions() dans lib/entitlements.ts.
  const cheapestUpgrade = upgradeOptions(plan).sort(
    (a, b) => ENTITLEMENTS[a].priceMonthly - ENTITLEMENTS[b].priceMonthly,
  )[0] as Plan | undefined;

  // Deux modules indépendants (Acquisition / Business OS) — le mode choisi
  // par le client (onboarding, ou changé depuis Paramètres) pilote quelle
  // partie de la navigation est mise en avant. "both" (par défaut pour tout
  // compte existant, jamais changé rétroactivement) affiche tout, exactement
  // comme avant cette évolution — aucun compte ne perd d'accès.
  const mode = businessProfile?.product_mode ?? "both";
  const hasBusinessOsPlan = businessOsAtLeast(plan, "standard");
  const dashboardHref = mode === "business_os" ? "/business-os" : "/dashboard";

  // Cinq entrées principales repliables (Accueil/Développer/Gérer/NOVA/
  // Analyser) au lieu de 13 liens en permanence visibles — chaque lien
  // reste soumis à EXACTEMENT les mêmes conditions qu'avant (mode
  // acquisition/business_os/both, plan Business OS, Centre d'actions NOVA),
  // seule la présentation change (voir NavSection : replié par défaut, sauf
  // la section de la page courante).
  const showDeveloperLinks = mode !== "business_os";
  const showManageSection = mode === "business_os" || mode === "both";
  const showAnalytics = mode !== "business_os";

  const navLinks = (
    <div className="flex flex-col gap-1">
      <NavLink href={dashboardHref} icon="⌂" badge={mode === "business_os" && !hasBusinessOsPlan ? "PRO" : undefined}>
        Accueil
      </NavLink>

      <NavSection label="Développer" icon="⌕" hrefs={showDeveloperLinks ? ["/prospection", "/crm", "/studio"] : ["/studio"]}>
        {showDeveloperLinks && (
          <>
            <NavLink href="/prospection" icon="⌕">
              Prospection
            </NavLink>
            <NavLink href="/crm" icon="▦">
              CRM
            </NavLink>
          </>
        )}
        <NavLink href="/studio" icon="🎨">
          Studio IA
        </NavLink>
      </NavSection>

      {showManageSection && (
        <NavSection label="Gérer" icon="▣" hrefs={["/business-os", "/automatisations"]}>
          <NavLink href="/business-os" icon="▣" badge={hasBusinessOsPlan ? undefined : "PRO"}>
            Business OS
          </NavLink>
          <NavLink href="/automatisations" icon="⚡">
            Automatisations
          </NavLink>
        </NavSection>
      )}

      <NavSection label="NOVA" icon="✦" hrefs={["/agent", "/missions", "/nova/actions"]}>
        <NavLink href="/agent" icon="✦">
          Assistant
        </NavLink>
        <NavLink href="/missions" icon="🧭">
          Missions
        </NavLink>
        {entitlements.canUseActionCenter && (
          <NavLink href="/nova/actions" icon="🎯">
            Centre d&apos;actions
          </NavLink>
        )}
      </NavSection>

      {showAnalytics && (
        <NavLink href="/analytics" icon="◫">
          Analyser
        </NavLink>
      )}
    </div>
  );

  // Lien secondaire discret vers l'autre module — jamais un vrai lien de
  // navigation (pas de badge actif), juste une porte d'entrée visible sans
  // encombrer le menu principal (spec produit : "bouton secondaire").
  const crossModuleLink =
    mode === "business_os" ? (
      <Link href="/prospection" className="rounded-lg border border-dashed border-sidebar-line px-3 py-2 text-[11px] font-semibold text-sidebar-ink-dim hover:border-accent hover:text-white">
        + Développer votre clientèle B2B
      </Link>
    ) : mode === "acquisition" ? (
      <Link href="/business-os" className="rounded-lg border border-dashed border-sidebar-line px-3 py-2 text-[11px] font-semibold text-sidebar-ink-dim hover:border-accent hover:text-white">
        + Business OS {hasBusinessOsPlan ? "" : "(option)"}
      </Link>
    ) : null;

  const planBadge = (
    <div className="rounded-xl border border-sidebar-line bg-white/[0.04] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-sidebar-ink-dim">Forfait actuel</p>
      <p className="mt-1 font-display text-[13px] font-extrabold text-white">
        PLAN {entitlements.label.toUpperCase()}
      </p>
      {cheapestUpgrade && (
        <Link
          href="/abonnement"
          className="mt-2.5 block rounded-lg bg-gradient-to-br from-accent to-accent-2 px-3 py-1.5 text-center text-[11.5px] font-bold text-white shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-px"
        >
          Passer à {ENTITLEMENTS[cheapestUpgrade].label}
        </Link>
      )}
    </div>
  );

  const logo = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 font-display text-[12px] font-extrabold text-white shadow-[var(--shadow-sm)]">
        PF
      </div>
      <div>
        <p className="font-display text-[13px] font-extrabold text-white">ProspectFlow</p>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-sidebar-ink-dim">
          {workspace?.name ?? "Mon espace"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[248px_1fr]">
      {/* Desktop : sidebar fixe. Cachée sous md, remplacée par le menu déroulant mobile ci-dessous. */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 overflow-y-auto border-r border-sidebar-line bg-sidebar p-3.5 text-sidebar-ink md:flex">
        <div className="px-1.5 pb-5 pt-1">{logo}</div>
        {navLinks}
        <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-line pt-3.5">
          {crossModuleLink}
          {planBadge}
          <ProfileMenu email={user.email ?? ""} />
        </div>
      </aside>

      {/* Mobile : bandeau + menu <details> natif, sans JS ni hydratation client pour l'ouverture/fermeture globale. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-sidebar-line bg-sidebar px-3.5 py-2.5 text-sidebar-ink md:hidden">
        {logo}
        <details className="relative">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-sidebar-line text-lg">
            ☰
          </summary>
          <div className="absolute right-0 top-11 flex max-h-[80vh] w-64 flex-col gap-1 overflow-y-auto rounded-xl border border-sidebar-line bg-sidebar p-2.5 shadow-[var(--shadow-lg)]">
            {navLinks}
            <div className="mt-1 flex flex-col gap-3 border-t border-sidebar-line pt-2">
              {crossModuleLink}
              {planBadge}
              <ProfileMenu email={user.email ?? ""} />
            </div>
          </div>
        </details>
      </header>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 hidden h-14 items-center justify-between border-b border-line bg-bg/90 px-6 backdrop-blur md:flex">
          <span className="font-display text-[13px] font-extrabold">{workspace?.name ?? "—"}</span>
          <span className="text-[12px] text-muted">{user.email}</span>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
