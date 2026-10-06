"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

/**
 * N'anime que les valeurs qui sont un entier pur (ex. "7", "-3") — jamais de
 * tentative sur un montant formaté ("1 234 €"), un pourcentage ou une date :
 * mal parser afficherait un nombre faux pendant l'animation. Dans ce cas on
 * affiche simplement la valeur telle quelle, sans animation.
 */
function useCountUp(value: string, durationMs = 500): string {
  const target = /^-?\d+$/.test(value.trim()) ? Number(value) : null;
  const [display, setDisplay] = useState(target ?? 0);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const from = prevTarget.current ?? 0;
    prevTarget.current = target;
    if (from === target) {
      setDisplay(target);
      return;
    }
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (target! - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return target === null ? value : String(display);
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const display = useCountUp(value);
  return (
    <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 bg-[image:var(--gradient-signature)] bg-clip-text font-display text-xl font-extrabold text-transparent">{display}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}
