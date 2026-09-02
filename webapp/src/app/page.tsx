import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#8fb0ff] font-display text-sm font-extrabold text-white">
          PF
        </div>
        <h1 className="max-w-xl text-balance font-display text-4xl font-extrabold tracking-tight">
          Trouvez de vrais clients, pas des suppositions.
        </h1>
        <p className="max-w-md text-pretty text-[15px] leading-relaxed text-muted">
          ProspectFlow vérifie chaque entreprise (registre officiel + Google) avant
          de vous la montrer. Aucun prospect fictif, aucune donnée inventée.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg"
        >
          Démarrer gratuitement
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-line bg-panel px-5 py-2.5 text-sm font-semibold text-ink"
        >
          Se connecter
        </Link>
      </div>
    </main>
  );
}
