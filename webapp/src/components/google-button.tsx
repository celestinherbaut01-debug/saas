"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const TIMEOUT_MS = 8000;
const DEV = process.env.NODE_ENV !== "production";

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`TIMEOUT_${ms}MS`)), ms);
  });
}

/**
 * Vraie connexion Google OAuth via Supabase Auth : redirige réellement vers
 * l'écran de sélection de compte Google (aucune simulation). Nécessite que
 * le provider Google soit activé dans Supabase Auth (voir README) — sans
 * quoi Supabase renverra une erreur explicite, jamais une fausse session.
 *
 * Promise.race avec un vrai timeout : si signInWithOAuth ne répond jamais
 * (réseau, storage bloqué...), le timeout gagne la course et reprend la
 * main — le bouton ne peut plus rester bloqué indéfiniment. Un panneau de
 * debug visible (hors production) montre l'étape exacte atteinte, pour ne
 * pas dépendre de la console navigateur.
 */
export function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);

  function log(line: string) {
    if (DEV) setSteps((prev) => [...prev, line]);
  }

  async function handleClick() {
    setSteps([]);
    setLoading(true);
    setError(null);
    log("Bouton cliqué.");

    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);
    log(`redirectTo = ${redirectTo.toString()}`);

    if (!clientRef.current) {
      clientRef.current = createClient();
      log("Client Supabase créé (une seule fois, réutilisé ensuite).");
    }
    const supabase = clientRef.current;

    log("Appel signInWithOAuth...");
    try {
      const { data, error: oauthError } = await Promise.race([
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: redirectTo.toString(), skipBrowserRedirect: true },
        }),
        timeout(TIMEOUT_MS),
      ]);

      log("Réponse Supabase reçue.");

      if (oauthError) {
        log(`error = ${oauthError.message}`);
        setError(oauthError.message);
        setLoading(false);
        return;
      }

      if (!data?.url) {
        log("data.url = (vide) — aucune URL retournée sans erreur.");
        setError("Impossible de lancer la connexion Google (aucune URL reçue).");
        setLoading(false);
        return;
      }

      log(`data.url = ${data.url}`);
      log("Redirection (window.location.assign)...");
      window.location.assign(data.url);
      // Le composant démonte au changement de page — pas de setLoading(false) ici.
    } catch (err) {
      if (err instanceof Error && err.message === `TIMEOUT_${TIMEOUT_MS}MS`) {
        log(`Bloqué : signInWithOAuth n'a pas répondu après ${TIMEOUT_MS / 1000}s.`);
        setError("Impossible de lancer la connexion Google. Réessayez.");
      } else {
        log(`Exception : ${err instanceof Error ? err.message : String(err)}`);
        setError("Impossible de lancer la connexion Google.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleClick}
        disabled={loading}
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4c-7.4 0-13.8 4.2-17 10.3z"/>
          <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 35.4 27 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5C9.9 39.7 16.4 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.5l6.6 5.4C41.5 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5z"/>
        </svg>
        {loading ? "Redirection vers Google…" : "Continuer avec Google"}
      </Button>
      {error && <p className="text-[12px] text-red-fg">{error}</p>}
      {DEV && steps.length > 0 && (
        <div className="rounded-lg border border-line bg-soft p-2.5 font-mono text-[10.5px] leading-relaxed text-muted">
          <p className="mb-1 font-sans font-bold text-faint">Debug OAuth (visible en dev uniquement)</p>
          {steps.map((s, i) => (
            <div key={i}>• {s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
