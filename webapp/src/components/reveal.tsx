"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
// Côté serveur, on ne sait pas — on part du principe le plus sûr (pas
// d'animation) pour ne jamais laisser un contenu invisible si le JS
// n'hydrate pas encore.
function getReducedMotionServerSnapshot() {
  return true;
}

/**
 * Anime l'entrée d'une section au scroll — IntersectionObserver natif,
 * aucune librairie ajoutée. Respecte prefers-reduced-motion via
 * useSyncExternalStore (lu, jamais recopié dans un state local — voir la
 * règle react-hooks/set-state-in-effect).
 */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // rootMargin très généreux : un défilement rapide (molette, touche
      // Fin, glisser la barre de scroll) peut faire "sauter" un élément
      // sans qu'aucune frame rendue ne le montre strictement dans le
      // viewport — sans marge, l'observer ne se déclencherait jamais et la
      // section resterait invisible en permanence. Mieux vaut révéler un
      // peu tôt/tard que risquer un contenu qui ne s'affiche jamais.
      { threshold: 0, rootMargin: "600px 0px 600px 0px" },
    );
    observer.observe(el);
    // Filet de sécurité : un contenu ne doit jamais rester invisible
    // indéfiniment si l'observer ne se déclenche pas pour une raison
    // inattendue (ex. élément hors du flux normal du document).
    const fallback = setTimeout(() => setVisible(true), 2000);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={cn(!reduced && "transition-all duration-700 ease-out", !reduced && (visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"), className)}
      style={!reduced ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
