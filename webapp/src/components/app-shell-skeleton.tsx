// Affiché par les loading.tsx des routes protégées pendant que le vrai
// AppShell (async : auth + workspace + plan) et les données de la page se
// chargent — évite un écran blanc et un flash de mise en page (même
// ossature grille sidebar/contenu que le vrai AppShell) le temps que
// Next.js suspende le rendu du Server Component réel derrière.
export function AppShellSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-3 border-r border-sidebar-line bg-sidebar p-3.5 md:flex">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.06]" />
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <div className="hidden h-14 border-b border-line bg-bg/90 md:block" />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-6">
            <div className="h-7 w-56 animate-pulse rounded-lg bg-soft" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-soft" />
              ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-soft" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
