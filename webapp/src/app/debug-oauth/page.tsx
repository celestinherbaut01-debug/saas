"use client";

// Page temporaire, volontairement sans design ni logique annexe (pas de
// "rester connecté", pas de composant partagé) : sert uniquement à savoir
// si le blocage vient de Supabase lui-même ou du composant GoogleButton.
// À supprimer une fois le bug Google réglé.

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TIMEOUT après ${ms}ms — signInWithOAuth n'a jamais répondu`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export default function DebugOAuthPage() {
  const [log, setLog] = useState<string[]>(["En attente du clic."]);

  function addLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function run() {
    setLog(["Bouton cliqué."]);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    addLog(`NEXT_PUBLIC_SUPABASE_URL = ${supabaseUrl || "(absent)"}`);
    addLog(`NEXT_PUBLIC_SUPABASE_ANON_KEY = ${supabaseKey ? supabaseKey.slice(0, 12) + "..." : "(absent)"}`);

    if (!supabaseUrl || !supabaseKey) {
      addLog("ARRÊT : variable d'environnement manquante.");
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    addLog(`redirectTo = ${redirectTo}`);

    addLog("Création du client Supabase...");
    const supabase = createBrowserClient(supabaseUrl, supabaseKey);

    addLog("Appel signInWithOAuth (timeout 8s)...");
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        }),
        8000,
      );

      addLog(`Réponse reçue.`);
      addLog(`error = ${error ? JSON.stringify({ message: error.message, status: error.status }) : "null"}`);
      addLog(`data.url = ${data?.url ?? "(vide)"}`);

      if (error) {
        addLog("ARRÊT : Supabase a renvoyé une erreur (voir ci-dessus).");
        return;
      }
      if (!data?.url) {
        addLog("ARRÊT : aucune URL retournée par Supabase, sans erreur explicite.");
        return;
      }

      addLog("Redirection dans 2 secondes (window.location.assign)...");
      setTimeout(() => window.location.assign(data.url), 2000);
    } catch (e) {
      addLog(`EXCEPTION / TIMEOUT : ${e instanceof Error ? e.message : String(e)}`);
      addLog("=> signInWithOAuth est resté bloqué plus de 8s sans jamais répondre. Le problème est côté Supabase/réseau, pas côté composant.");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace", maxWidth: 700 }}>
      <h1>Debug OAuth Google (page temporaire)</h1>
      <button onClick={run} style={{ padding: "10px 16px", fontSize: 14, marginTop: 12 }}>
        Lancer le test
      </button>
      <pre
        style={{
          marginTop: 20,
          padding: 16,
          background: "#111",
          color: "#0f0",
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {log.join("\n")}
      </pre>
    </main>
  );
}
