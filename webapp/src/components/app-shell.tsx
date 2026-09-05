import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership, getCachedBusinessProfile } from "@/lib/session";
import { getWorkspacePlan } from "@/lib/plan";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
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

  const acquisitionLinks = (
    <>
      <NavLink href="/dashboard" icon="⌂">
        Dashboard
      </NavLink>
      <NavLink href="/prospection" icon="⌕">
        Prospection
      </NavLink>
      <NavLink href="/crm" icon="▦">
        CRM
      </NavLink>
      <NavLink href="/agent" icon="✦">
        NOVA
      </NavLink>
      <NavLink href="/analytics" icon="◫">
        Analytics
      </NavLink>
    </>
  );

  const accountLinks = (
    <>
      <NavLink href="/abonnement" icon="◆">
        Abonnement
      </NavLink>
      <NavLink href="/integrations" icon="◎">
        Intégrations
      </NavLink>
      <NavLink href="/parametres" icon="⚙">
        Paramètres
      </NavLink>
    </>
  );

  const navSections: Array<{ label: string; items: React.ReactNode }> = [];

  if (mode === "business_os") {
    // Business OS au premier plan : la Prospection n'est volontairement pas
    // dans la navigation principale (voir le lien secondaire discret
    // ci-dessous, sous la sidebar) — un garagiste qui a choisi "gérer mon
    // entreprise" n'a pas besoin d'un menu de prospection en évidence.
    navSections.push({
      label: "",
      items: (
        <>
          <NavLink href="/business-os" icon="⌂" badge={hasBusinessOsPlan ? undefined : "PRO"}>
            Dashboard
          </NavLink>
          <NavLink href="/agent" icon="✦">
            NOVA
          </NavLink>
          <NavLink href="/automatisations" icon="⚡">
            Automatisations
          </NavLink>
        </>
      ),
    });
  } else if (mode === "acquisition") {
    navSections.push({ label: "", items: acquisitionLinks });
  } else {
    navSections.push({ label: "Acquisition", items: acquisitionLinks });
    navSections.push({
      label: "Gestion",
      items: (
        <>
          <NavLink href="/business-os" icon="▣" badge={hasBusinessOsPlan ? undefined : "PRO"}>
            Business OS
          </NavLink>
          <NavLink href="/automatisations" icon="⚡">
            Automatisations
          </NavLink>
        </>
      ),
    });
  }

  navSections.push({ label: "Compte", items: accountLinks });

  const navLinks = (
    <>
      {navSections.map((section, i) => (
        <div key={section.label || `section-${i}`} className="flex flex-col gap-1">
          {section.label && (
            <p className="px-3 pb-1 pt-3 text-[9.5px] font-bold uppercase tracking-wider text-sidebar-ink-dim/70 first:pt-0">
              {section.label}
            </p>
          )}
          {section.items}
        </div>
      ))}
    </>
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
          className="mt-2.5 block rounded-lg bg-gradient-to-br from-accent to-[#8fb0ff] px-3 py-1.5 text-center text-[11.5px] font-bold text-white shadow-sm transition-transform hover:-translate-y-px"
        >
          Passer à {ENTITLEMENTS[cheapestUpgrade].label}
        </Link>
      )}
    </div>
  );

  const logo = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#8fb0ff] font-display text-[12px] font-extrabold text-white">
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
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="w-full bg-transparent text-sidebar-ink">
              Se déconnecter
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile : bandeau + menu <details> natif, sans JS ni hydratation client. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-sidebar-line bg-sidebar px-3.5 py-2.5 text-sidebar-ink md:hidden">
        {logo}
        <details className="relative">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-sidebar-line text-lg">
            ☰
          </summary>
          <div className="absolute right-0 top-11 flex max-h-[80vh] w-64 flex-col gap-1 overflow-y-auto rounded-xl border border-sidebar-line bg-sidebar p-2.5 shadow-lg">
            {navLinks}
            <div className="mt-1 flex flex-col gap-3 border-t border-sidebar-line pt-2">
              {crossModuleLink}
              {planBadge}
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm" className="w-full bg-transparent text-sidebar-ink">
                  Se déconnecter
                </Button>
              </form>
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
