"use client";

import { createContext, useContext } from "react";

// Contexte plutôt qu'un prop `collapsed` à faire descendre manuellement
// dans chaque <NavLink>/<NavSection> depuis app-shell.tsx (composant serveur
// qui ne peut pas lire lui-même le store client) — voir sidebar-shell.tsx
// pour le Provider.
const SidebarCollapseContext = createContext(false);

export function useSidebarCollapsed(): boolean {
  return useContext(SidebarCollapseContext);
}

export const SidebarCollapseProvider = SidebarCollapseContext.Provider;
