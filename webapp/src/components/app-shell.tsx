import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { getWorkspacePlan } from "@/lib/plan";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { ENTITLEMENTS, PLAN_ORDER, businessOsAtLeast, type Plan } from "@/lib/entitlements";

export async function AppShell({ children }: { children: React.ReactNode }) {
  // Primitives mémorisées par requête : si la page qui a rendu <AppShell>
  // a déjà appelé getCachedUser()/getCachedMembership() (c'est le cas de
  // toutes les pages protégées), ces appels ne refont AUCUN aller-retour
  // réseau — voir lib/session.ts et lib/plan.ts pour le détail.
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const membership = await getCachedMembership(user.id);

  const supabase = await createClient();
  const [{ data: workspace }, plan] = await Promise.all([
    membership
      ? supabase.from("workspaces").select("name").eq("id", membership.workspace_id).maybeSingle()
      : Promise.resolve({ data: null }),
    membership ? getWorkspacePlan(membership.workspace_id) : Promise.resolve<Plan>("free"),
  ]);
  const entitlements = ENTITLEMENTS[plan];
  const nextPlan = PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1] as Plan | undefined;

  const navSections: Array<{ label: string; items: React.ReactNode }> = [
    {
      label: "Prospection",
      items: (
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
      ),
    },
    {
      label: "Gestion",
      items: (
        <>
          <NavLink href="/business-os" icon="▣" badge={businessOsAtLeast(plan, "standard") ? undefined : "PRO"}>
            Business OS
          </NavLink>
          <NavLink href="/abonnement" icon="◆">
            Abonnements
          </NavLink>
          <NavLink href="/integrations" icon="◎">
            Intégrations
          </NavLink>
        </>
      ),
    },
    {
      label: "Compte",
      items: (
        <NavLink href="/parametres" icon="⚙">
          Paramètres
        </NavLink>
      ),
    },
  ];

  const navLinks = (
    <>
      {navSections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 pt-3 text-[9.5px] font-bold uppercase tracking-wider text-sidebar-ink-dim/70 first:pt-0">
            {section.label}
          </p>
          {section.items}
        </div>
      ))}
    </>
  );

  const planBadge = (
    <div className="rounded-xl border border-sidebar-line bg-white/[0.04] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-sidebar-ink-dim">Forfait actuel</p>
      <p className="mt-1 font-display text-[13px] font-extrabold text-white">
        PLAN {entitlements.label.toUpperCase()}
      </p>
      {nextPlan && (
        <Link
          href="/abonnement"
          className="mt-2.5 block rounded-lg bg-gradient-to-br from-accent to-[#8fb0ff] px-3 py-1.5 text-center text-[11.5px] font-bold text-white shadow-sm transition-transform hover:-translate-y-px"
        >
          Passer à {ENTITLEMENTS[nextPlan].label}
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
