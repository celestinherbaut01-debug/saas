"use client";

// Store externe (voir useSyncExternalStore dans sidebar-shell.tsx) — même
// principe que la détection prefers-reduced-motion dans reveal.tsx : évite
// tout setState-in-effect, et le snapshot serveur (toujours "déplié") garantit
// qu'il n'y a jamais de mismatch d'hydratation, seulement un re-render une
// fois le vrai état localStorage connu côté client.
const STORAGE_KEY = "pf-sidebar-collapsed";
const listeners = new Set<() => void>();

export function getSidebarCollapsedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getSidebarCollapsedServerSnapshot(): boolean {
  return false;
}

export function subscribeSidebarCollapsed(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setSidebarCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Stockage indisponible (navigation privée...) : le réglage ne persiste
    // simplement pas, jamais bloquant pour l'usage courant.
  }
  for (const listener of listeners) listener();
}
