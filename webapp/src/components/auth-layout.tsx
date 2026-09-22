import Link from "next/link";
import { Card } from "@/components/ui/card";

/**
 * Habillage commun /login + /signup — remplace le simple <Card> flottant sur
 * fond plat (aucune identité visuelle) par une composition avec logo, glow
 * signature et profondeur, cohérente avec la landing publique.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)" }}
      />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-signature)] font-display text-[13px] font-extrabold text-accent-ink shadow-[var(--shadow-sm)]">
            PF
          </div>
          <span className="font-display text-[15px] font-extrabold">ProspectFlow</span>
        </Link>
        <Card className="w-full shadow-[var(--shadow-lg)]">{children}</Card>
      </div>
    </main>
  );
}
