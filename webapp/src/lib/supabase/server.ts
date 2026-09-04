import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { REMEMBER_COOKIE, applyRememberPreference } from "@/lib/supabase/remember";

/**
 * Client Supabase pour Server Components / Server Actions / Route Handlers.
 * `cookies()` est asynchrone depuis Next.js 15+ (cf. node_modules/next/dist/docs).
 *
 * Enveloppé dans React `cache()` : dans UNE MÊME requête (un rendu de page,
 * ou une Server Action), plusieurs appels à `createClient()` — depuis la
 * page, AppShell, lib/plan.ts, lib/app-state.ts... — renvoient la même
 * instance mémorisée au lieu de recréer un client à chaque appel. `cache()`
 * de React est scopé par requête (jamais partagé entre deux visiteurs ni
 * entre deux requêtes différentes) — voir aussi getCachedUser ci-dessous
 * pour la déduplication de l'appel réseau `auth.getUser()` lui-même, qui est
 * la partie réellement coûteuse (vérifie le JWT auprès du serveur Auth).
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const remember = cookieStore.get(REMEMBER_COOKIE)?.value !== "0";
            applyRememberPreference(cookiesToSet, remember).forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component (pas une Server Action/Route
            // Handler) : l'écriture est ignorée, le proxy se charge du refresh
            // de session sur la requête suivante.
          }
        },
      },
    },
  );
});
