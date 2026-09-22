import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur sm:px-6">
      <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-signature)] font-display text-[12px] font-extrabold text-accent-ink shadow-[var(--shadow-sm)]">
          PF
        </div>
        <span className="font-display text-[14px] font-extrabold">ProspectFlow</span>
      </Link>
      <nav className="flex items-center gap-2 text-[13px] font-medium sm:gap-4">
        <Link href="/tarifs" className="hidden text-muted hover:text-ink sm:inline">
          Tarifs
        </Link>
        <Link href="/securite" className="hidden text-muted hover:text-ink sm:inline">
          Sécurité
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="shrink-0 whitespace-nowrap rounded-lg bg-[image:var(--gradient-signature)] px-2.5 py-1.5 text-[12.5px] font-semibold text-accent-ink shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md),var(--glow-accent)] sm:px-3.5 sm:text-[13px]"
          >
            Accéder à mon espace
          </Link>
        ) : (
          <>
            <Link href="/login" className="hidden text-muted hover:text-ink sm:inline">
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="shrink-0 whitespace-nowrap rounded-lg bg-[image:var(--gradient-signature)] px-2.5 py-1.5 text-[12.5px] font-semibold text-accent-ink shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md),var(--glow-accent)] sm:px-3.5 sm:text-[13px]"
            >
              Essayer gratuitement
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
