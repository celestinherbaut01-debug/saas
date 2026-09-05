"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { askNova, type NovaMessage } from "@/lib/actions/nova";
import type { NovaContext } from "@/lib/entitlements";

// NOVA Commercial (prospection/CRM/relances) et NOVA Métier (Business OS)
// sont deux contextes distincts — voir novaContexts() dans lib/entitlements.ts.
// Les suggestions affichées suivent les mêmes contextes que les outils
// réellement disponibles côté serveur : jamais une suggestion que NOVA ne
// pourrait pas honorer avec ce plan.
const COMMERCIAL_SUGGESTIONS = [
  "Fais-moi le récap du jour",
  "Qui dois-je relancer ?",
  "Trouve-moi les prospects sans site confirmé",
  "Rédige un email pour mon prospect le mieux noté",
];
const METIER_SUGGESTIONS = [
  "Quels rendez-vous ai-je cette semaine ?",
  "Quels produits sont en stock faible ?",
  "Fais-moi un résumé de mon activité",
];

export function AgentChat({
  workspaceId,
  configured,
  initialPrompt,
  contexts,
}: {
  workspaceId: string;
  configured: boolean;
  initialPrompt?: string;
  contexts: NovaContext[];
}) {
  const [messages, setMessages] = useState<NovaMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSent = useRef(false);

  const hasCommercial = contexts.includes("commercial");
  const hasMetier = contexts.includes("metier");
  const suggestions = [
    ...(hasCommercial ? COMMERCIAL_SUGGESTIONS : []),
    ...(hasMetier ? METIER_SUGGESTIONS : []),
  ];

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setError(null);
    const next: NovaMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    const result = await askNova(workspaceId, next);
    setSending(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
  }

  // Ouvert depuis une fiche prospect (ex. "Préparer un email") avec un
  // prompt déjà rempli dans l'URL : envoyé une seule fois à l'ouverture,
  // jamais à chaque re-render.
  useEffect(() => {
    if (initialPrompt && configured && !autoSent.current) {
      autoSent.current = true;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, configured]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold">Agent IA — NOVA</h1>
          <div className="flex gap-1.5">
            {hasCommercial && (
              <span className="rounded-full border border-line bg-soft px-2.5 py-1 text-[10.5px] font-bold text-muted">
                NOVA Commercial
              </span>
            )}
            {hasMetier && (
              <span className="rounded-full border border-line bg-soft px-2.5 py-1 text-[10.5px] font-bold text-muted">
                NOVA Métier
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          {hasCommercial && hasMetier
            ? "Répond avec les vraies données de votre workspace — CRM/prospects et Business OS — jamais une supposition."
            : hasCommercial
              ? "Répond avec les vraies données de votre CRM et de vos prospects — jamais une supposition."
              : "Répond avec les vraies données de votre Business OS — jamais une supposition."}
        </p>
      </div>

      {!configured && (
        <Card className="border-amber-bg bg-amber-bg">
          <p className="text-[13px] font-semibold text-amber-fg">Agent IA non configuré</p>
          <p className="mt-1 text-[12.5px] text-amber-fg">
            Il manque la variable d&apos;environnement <code className="font-mono">ANTHROPIC_API_KEY</code> côté
            serveur. Une fois ajoutée (voir README), NOVA répond en utilisant les vrais outils sur votre base — rien
            n&apos;est simulé en attendant.
          </p>
        </Card>
      )}

      <Card className="flex h-[520px] flex-col">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-[13px] text-muted">
                {hasCommercial && hasMetier
                  ? "Posez une question sur vos prospects, votre CRM, ou votre activité."
                  : hasCommercial
                    ? "Posez une question sur vos prospects ou votre CRM."
                    : "Posez une question sur votre activité."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={!configured}
                    className="rounded-full border border-line bg-soft px-3 py-1.5 text-[11.5px] disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2 text-[13px] text-bg"
                    : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-soft px-3.5 py-2 text-[13px] text-ink"
                }
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-soft px-3.5 py-2 text-[13px] text-muted">
                NOVA réfléchit…
              </div>
            )}
          </div>
        </div>

        {error && <p className="mt-2 text-[12px] text-red-fg">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              !configured
                ? "Configurez ANTHROPIC_API_KEY pour activer NOVA"
                : hasCommercial
                  ? "Ex. Qui dois-je relancer ?"
                  : "Ex. Quels rendez-vous ai-je cette semaine ?"
            }
            disabled={!configured || sending}
            className="flex-1 rounded-lg border border-line bg-soft px-3 py-2 text-[13px] disabled:opacity-50"
          />
          <Button type="submit" disabled={!configured || sending}>
            Envoyer
          </Button>
        </form>
      </Card>
    </div>
  );
}
