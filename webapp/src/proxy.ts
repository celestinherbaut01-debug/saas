import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, applyRememberPreference } from "@/lib/supabase/remember";

// Next.js 16 a renommé middleware.ts -> proxy.ts (même mécanique, juste le
// nom du fichier/export a changé — cf. node_modules/next/dist/docs).
//
// Rôle : rafraîchir la session Supabase à chaque requête et protéger les
// routes de l'application pour les utilisateurs non connectés / pas encore
// onboardés.

// "/debug-oauth" est temporaire (diagnostic du bouton Google) — à retirer
// d'ici en même temps que la page une fois le bug résolu.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/tarifs", "/debug-oauth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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

  if (!user) {
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Contrairement à avant, un utilisateur connecté qui visite /login ou
  // /signup n'est plus redirigé automatiquement : ces pages affichent
  // elles-mêmes un écran "Vous êtes déjà connecté" (voir SessionGate) —
  // aucune redirection invisible, l'utilisateur choisit explicitement.
  if (pathname.startsWith("/auth") || pathname === "/onboarding") {
    return response;
  }

  // "/" reste toujours la landing publique, même connecté — plus de
  // redirection automatique et invisible vers /onboarding ou /dashboard
  // simplement parce qu'une session existe.
  if (pathname === "/") {
    return response;
  }

  // Connecté mais pas encore onboardé -> forcer l'onboarding avant le reste
  // de l'application (dashboard, prospection, etc.).
  if (!isPublicPath(pathname)) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    // Jamais de undefined silencieux : on logue explicitement l'état lu,
    // pour distinguer "profil absent" (bug réel) de "pas encore onboardé"
    // (comportement normal).
    if (profileError) {
      console.error("[proxy] erreur lecture profiles :", profileError.message);
    } else if (!profile) {
      console.warn("[proxy] PROFILE ABSENT pour user.id =", user.id);
    } else {
      console.log("[proxy] onboarding_completed =", profile.onboarding_completed);
    }

    if (profile?.onboarding_completed !== true && pathname !== "/onboarding") {
      console.log("[proxy] redirect =", "/onboarding");
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    if (profile?.onboarding_completed === true) {
      console.log("[proxy] redirect =", pathname, "(autorisé)");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
