"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/components/sidebar-collapse-context";

/**
 * Groupe de liens repliable — remplace les sections toujours dépliées
 * (13 liens visibles en permanence, jamais ce que l'utilisateur voulait).
 * Ouvert par défaut uniquement si la page courante en fait partie ;
 * se réouvre automatiquement à la navigation vers l'une de ses pages.
 */
export function NavSection({
  label,
  icon,
  hrefs,
  children,
}: {
  label: string;
  icon: string;
  hrefs: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const containsActive = hrefs.some((h) => pathname === h);
  // `null` = suit la page courante (s'ouvre automatiquement dessus) ;
  // true/false = l'utilisateur a explicitement replié/déplié — dérivé,
  // jamais synchronisé via un effet (voir react-hooks/set-state-in-effect).
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const open = manualOverride ?? containsActive;
  const collapsed = useSidebarCollapsed();

  // Sidebar en mode icônes : un groupe repliable n'a pas de place pour un
  // accordéon — il devient un simple lien direct vers sa première page,
  // avec l'icône seule et un tooltip natif pour le libellé.
  if (collapsed) {
    return (
      <Link
        href={hrefs[0]}
        title={label}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg text-[13px] transition-colors",
          containsActive ? "bg-sidebar-active text-white shadow-[var(--shadow-sm)]" : "text-sidebar-ink-dim hover:bg-white/[0.06] hover:text-white",
        )}
      >
        {icon}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setManualOverride(!open)}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors",
          containsActive ? "text-white" : "text-sidebar-ink-dim hover:bg-white/[0.06] hover:text-white",
        )}
      >
        <span className="w-4 text-center text-[13px] opacity-80">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <span className={cn("text-[10px] transition-transform", open && "rotate-90")}>▸</span>
      </button>
      {open && <div className="ml-3.5 flex flex-col gap-0.5 border-l border-sidebar-line pl-2.5">{children}</div>}
    </div>
  );
}
