import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/components/sidebar-collapse-context";

/**
 * Compte replié derrière le profil — natif (<details>), aucun JS requis,
 * même mécanisme que le menu mobile déjà dans ce fichier. Remplace la
 * section "Compte" auparavant toujours visible en permanence dans la
 * sidebar.
 */
export function ProfileMenu({ email }: { email: string }) {
  const collapsed = useSidebarCollapsed();

  return (
    <details className="group relative">
      <summary
        title={collapsed ? email : undefined}
        className={cn(
          "flex cursor-pointer list-none items-center gap-2.5 rounded-lg border border-sidebar-line text-[12.5px] font-medium text-sidebar-ink-dim hover:bg-white/[0.06] hover:text-white",
          collapsed ? "h-10 w-10 justify-center px-0" : "px-3 py-2.5",
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white">
          {email.slice(0, 1).toUpperCase()}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{email}</span>
            <span className="text-[10px] opacity-70">▾</span>
          </>
        )}
      </summary>
      <div className="absolute bottom-full left-0 mb-2 flex w-52 flex-col gap-1 rounded-xl border border-sidebar-line bg-sidebar p-2 shadow-[var(--shadow-lg)]">
        <Link href="/abonnement" className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-sidebar-ink-dim hover:bg-white/[0.06] hover:text-white">
          ◆ Abonnement
        </Link>
        <Link href="/integrations" className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-sidebar-ink-dim hover:bg-white/[0.06] hover:text-white">
          ◎ Intégrations
        </Link>
        <Link href="/parametres" className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-sidebar-ink-dim hover:bg-white/[0.06] hover:text-white">
          ⚙ Paramètres
        </Link>
        <form action={signOut} className="border-t border-sidebar-line pt-1.5">
          <Button type="submit" variant="outline" size="sm" className="w-full bg-transparent text-sidebar-ink">
            Se déconnecter
          </Button>
        </form>
      </div>
    </details>
  );
}
