import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, applyRememberPreference } from "@/lib/supabase/remember";

// Next.js 16 a renommé middleware.ts -> proxy.ts (même mécanique, juste le
// nom du fichier/export a changé — cf. node_modules/next/dist/docs).
//
// Rôle volontairement réduit au minimum : protéger les pages privées des
// visiteurs non connectés. Rien d'autre. L'onboarding non terminé n'est
// PLUS un motif de redirection ici — ce n'est plus une prison qui bloque
// tout le SaaS, seulement un état que l'UI (dashboard, prospection...)
// affiche et peut verrouiller fonctionnalité par fonctionnalité, via
// lib/app-state.ts (la même logique de lecture partout, plus de "proxy
// calcule une chose, une page en calcule une autre").
//
// Avantage direct : aucune lecture de profiles.onboarding_completed ici
// signifie que ce fichier ne peut plus, à lui seul, coincer qui que ce
// soit dans une boucle de redirection — toute la classe de bug rencontrée
// (found=false, cache de redirection, etc.) devient structurellement
// impossible à ce niveau.

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/tarifs", "/securite", "/debug-oauth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function noStoreRedirect(url: URL) {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";
          applyRememberPreference(cookiesToSet, remember).forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return noStoreRedirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
