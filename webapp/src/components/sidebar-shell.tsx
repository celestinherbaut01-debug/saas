"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { getSidebarCollapsedServerSnapshot, getSidebarCollapsedSnapshot, setSidebarCollapsed, subscribeSidebarCollapsed } from "@/lib/sidebar-store";
import { SidebarCollapseProvider } from "@/components/sidebar-collapse-context";

/**
 * Sidebar desktop repliable en mode icônes — enveloppe la <aside> fixe
 * (app-shell.tsx reste un composant serveur ; seul ce wrapper est client
 * pour lire l'état replié/déplié, persisté en localStorage).
 */
export function SidebarShell({
  logo,
  collapsedLogo,
  navLinks,
  crossModuleLink,
  planBadge,
  profileMenu,
}: {
  logo: React.ReactNode;
  collapsedLogo: React.ReactNode;
  navLinks: React.ReactNode;
  crossModuleLink: React.ReactNode;
  planBadge: React.ReactNode;
  profileMenu: React.ReactNode;
}) {
  const collapsed = useSyncExternalStore(subscribeSidebarCollapsed, getSidebarCollapsedSnapshot, getSidebarCollapsedServerSnapshot);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen flex-col gap-1 overflow-y-auto border-r border-sidebar-line bg-sidebar p-3.5 text-sidebar-ink transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px] items-center px-2" : "w-[248px]",
      )}
    >
      <div className={cn("flex w-full items-center pb-5 pt-1", collapsed ? "justify-center px-0" : "px-1.5")}>
        {collapsed ? collapsedLogo : logo}
      </div>

      <SidebarCollapseProvider value={collapsed}>
        <div className={cn("flex w-full flex-1 flex-col gap-1", collapsed && "items-center")}>{navLinks}</div>
      </SidebarCollapseProvider>

      <div className={cn("mt-auto flex w-full flex-col gap-3 border-t border-sidebar-line pt-3.5", collapsed && "items-center")}>
        {!collapsed && crossModuleLink}
        {!collapsed && planBadge}
        <SidebarCollapseProvider value={collapsed}>{profileMenu}</SidebarCollapseProvider>
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!collapsed)}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-lg border border-sidebar-line text-[12px] text-sidebar-ink-dim transition hover:border-accent/40 hover:text-white"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
    </aside>
  );
}
