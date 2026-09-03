import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { ENTITLEMENTS, planAtLeast, type Plan } from "@/lib/entitlements";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = membership
    ? (await supabase.from("workspaces").select("name").eq("id", membership.workspace_id).maybeSingle()).data
    : null;

  const subscription = membership
    ? (
        await supabase
          .from("subscriptions")
          .select("plan")
          .eq("workspace_id", membership.workspace_id)
          .maybeSingle()
      ).data
    : null;
  const plan: Plan = subscription?.plan ?? "free";
  const entitlements = ENTITLEMENTS[plan];

  const navLinks = (
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
        Agent IA
      </NavLink>
      <NavLink href="/analytics" icon="◫">
        Analytics
      </NavLink>
      {planAtLeast(plan, "max") && (
        <NavLink href="/business-os" icon="▣">
          Business OS
        </NavLink>
      )}
      <NavLink href="/integrations" icon="◎">
        Intégrations
      </NavLink>
      <NavLink href="/parametres" icon="⚙">
        Paramètres
      </NavLink>
    </>
  );

  const logo = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#8fb0ff] font-display text-[12px] font-extrabold text-white">
        PF
      </div>
      <div>
        <p className="font-display text-[13px] font-extrabold text-white">ProspectFlow</p>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-sidebar-ink-dim">
          Plan {entitlements.label}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[240px_1fr]">
      {/* Desktop : sidebar fixe. Cachée sous md, remplacée par le menu déroulant mobile ci-dessous. */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-sidebar-line bg-sidebar p-3.5 text-sidebar-ink md:flex">
        <div className="px-1.5 pb-5 pt-1">{logo}</div>
        {navLinks}
        <div className="mt-auto border-t border-sidebar-line pt-3 text-[10px] leading-relaxed text-sidebar-ink-dim">
          <p className="mb-2">
            Un prospect non vérifié par Google Places reste marqué « à vérifier ».
          </p>
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
          <div className="absolute right-0 top-11 flex w-56 flex-col gap-1 rounded-xl border border-sidebar-line bg-sidebar p-2.5 shadow-lg">
            {navLinks}
            <form action={signOut} className="mt-1 border-t border-sidebar-line pt-2">
              <Button type="submit" variant="outline" size="sm" className="w-full bg-transparent text-sidebar-ink">
                Se déconnecter
              </Button>
            </form>
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
