import Link from "next/link";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-6 backdrop-blur">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#8fb0ff] font-display text-[12px] font-extrabold text-white">
          PF
        </div>
        <span className="font-display text-[14px] font-extrabold">ProspectFlow</span>
      </Link>
      <nav className="flex items-center gap-4 text-[13px] font-medium">
        <Link href="/tarifs" className="text-muted hover:text-ink">
          Tarifs
        </Link>
        <Link href="/securite" className="hidden text-muted hover:text-ink sm:inline">
          Sécurité
        </Link>
        <Link href="/login" className="text-muted hover:text-ink">
          Se connecter
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-bg"
        >
          Essayer gratuitement
        </Link>
      </nav>
    </header>
  );
}
