import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

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
  const plan = subscription?.plan ?? "starter";

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col gap-1 border-r border-sidebar-line bg-sidebar p-3.5 text-sidebar-ink">
        <div className="flex items-center gap-2.5 px-1.5 pb-5 pt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#8fb0ff] font-display text-[12px] font-extrabold text-white">
            PF
          </div>
          <div>
            <p className="font-display text-[13px] font-extrabold text-white">ProspectFlow</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-sidebar-ink-dim">
              Plan {plan}
            </p>
          </div>
        </div>

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
        {plan === "max" && (
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

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-6 backdrop-blur">
          <span className="font-display text-[13px] font-extrabold">{workspace?.name ?? "—"}</span>
          <span className="text-[12px] text-muted">{user.email}</span>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
