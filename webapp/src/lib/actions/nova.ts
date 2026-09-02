"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export interface NovaMessage {
  role: "user" | "assistant";
  content: string;
}

export async function isNovaConfigured(): Promise<boolean> {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const TOOLS = [
  {
    name: "get_daily_summary",
    description:
      "Récap réel du workspace : nombre total de prospects, répartition par statut CRM, prospects ajoutés aujourd'hui, nombre de métiers ciblés.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "search_prospects",
    description:
      "Recherche parmi les prospects déjà présents dans le CRM de ce workspace (jamais inventés), avec filtres optionnels.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["new", "to_contact", "contacted", "replied", "won", "lost"],
          description: "Étape CRM",
        },
        website_quality: {
          type: "string",
          enum: ["none", "weak", "ok", "unknown"],
          description: "Qualité du site détectée",
        },
        city: { type: "string", description: "Ville (recherche partielle)" },
        limit: { type: "number", description: "Nombre max de résultats (défaut 20, max 50)" },
      },
      required: [],
    },
  },
  {
    name: "get_prospect",
    description: "Détail complet d'un prospect précis, recherché par nom d'entreprise approchant.",
    input_schema: {
      type: "object" as const,
      properties: { company_name: { type: "string" } },
      required: ["company_name"],
    },
  },
];

async function runTool(workspaceId: string, name: string, input: Record<string, unknown>) {
  const supabase = await createClient();

  if (name === "get_daily_summary") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [{ count: total }, { count: addedToday }, { count: targets }, { data: statusRows }] = await Promise.all([
      supabase.from("prospects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase
        .from("prospects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfDay.toISOString()),
      supabase
        .from("workspace_targets")
        .select("category_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase.from("prospects").select("status").eq("workspace_id", workspaceId),
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of statusRows ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    return {
      total_prospects: total ?? 0,
      added_today: addedToday ?? 0,
      target_categories_count: targets ?? 0,
      by_status: byStatus,
    };
  }

  if (name === "search_prospects") {
    let query = supabase
      .from("prospects")
      .select("company_name, city, status, website_quality, business_status, quality_score, distance_km")
      .eq("workspace_id", workspaceId);
    const validStatuses = ["new", "to_contact", "contacted", "replied", "won", "lost"] as const;
    if (typeof input.status === "string" && (validStatuses as readonly string[]).includes(input.status)) {
      query = query.eq("status", input.status as (typeof validStatuses)[number]);
    }
    if (typeof input.website_quality === "string") query = query.eq("website_quality", input.website_quality);
    if (typeof input.city === "string") query = query.ilike("city", `%${input.city}%`);
    const limit = typeof input.limit === "number" ? Math.min(input.limit, 50) : 20;
    const { data } = await query.order("quality_score", { ascending: false }).limit(limit);
    return { count: data?.length ?? 0, results: data ?? [] };
  }

  if (name === "get_prospect") {
    const companyName = typeof input.company_name === "string" ? input.company_name : "";
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .ilike("company_name", `%${companyName}%`)
      .limit(1)
      .maybeSingle();
    return data ?? { error: "Aucun prospect ne correspond à ce nom dans le CRM." };
  }

  return { error: `Outil inconnu : ${name}` };
}

const SYSTEM_PROMPT =
  "Tu es NOVA, l'assistant commercial de ProspectFlow OS. Réponds en français, de façon concise et concrète. " +
  "Utilise TOUJOURS un outil pour obtenir des données réelles avant de répondre à une question sur les prospects, " +
  "le CRM ou des statistiques — ne devine et n'invente jamais un chiffre ou un nom d'entreprise. " +
  "Si une donnée n'est pas disponible via tes outils, dis-le clairement plutôt que d'inventer une réponse.";

export async function askNova(
  workspaceId: string,
  history: NovaMessage[],
): Promise<{ reply: string } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error:
        "NOVA n'est pas configuré — ajoutez ANTHROPIC_API_KEY dans les variables d'environnement du serveur (voir README).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round < 4; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((b) => b.type === "text");
      return { reply: textBlock && "text" in textBlock ? textBlock.text : "" };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = await runTool(workspaceId, block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { error: "NOVA n'a pas pu conclure après plusieurs appels d'outils — reformulez votre question." };
}
