"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast, type Plan } from "@/lib/entitlements";
import { assertNovaQuota, getUsage, incrementNovaUsage } from "@/lib/quota";
import { isValidProspectStatus } from "@/lib/crm-status";

export interface NovaMessage {
  role: "user" | "assistant";
  content: string;
}

export async function isNovaConfigured(): Promise<boolean> {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function getNovaUsage(workspaceId: string) {
  const plan = await getWorkspacePlan(workspaceId);
  return getUsage(workspaceId, "nova_requests", plan);
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const TOOLS = [
  {
    name: "get_my_business_profile",
    description:
      "L'entreprise de l'UTILISATEUR (pas un prospect) : nom, offre, audience, ton souhaité, signature. " +
      "À consulter avant de rédiger un email pour parler au nom de la bonne entreprise avec la bonne offre.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
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
          enum: ["new", "to_contact", "contacted", "replied", "interested", "rdv", "quote", "won", "lost", "do_not_contact"],
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

const BUSINESS_OS_TOOL = {
  name: "get_business_os_data",
  description:
    "Business OS (plan Max) : accède aux vraies données métier du workspace — clients, stock/pièces/consommables, " +
    "ou rendez-vous/interventions/planning selon le métier. Jamais inventé.",
  input_schema: {
    type: "object" as const,
    properties: {
      module: {
        type: "string",
        enum: ["customers", "inventory", "appointments"],
        description: "customers = clients/sites ; inventory = stock/pièces/consommables ; appointments = RDV/interventions/planning",
      },
      limit: { type: "number", description: "Nombre max de résultats (défaut 20, max 50)" },
    },
    required: ["module"],
  },
};

function buildTools(plan: Plan) {
  return businessOsAtLeast(plan, "advanced") ? [...TOOLS, BUSINESS_OS_TOOL] : TOOLS;
}

async function runTool(workspaceId: string, plan: Plan, name: string, input: Record<string, unknown>) {
  if (name === "get_business_os_data") {
    if (!businessOsAtLeast(plan, "advanced")) return { error: "NOVA connectée au Business OS réservé au plan Max." };
    const supabase = await createClient();
    const limit = typeof input.limit === "number" ? Math.min(input.limit, 50) : 20;
    const osModule = input.module;

    if (osModule === "customers") {
      const { data } = await supabase
        .from("customers")
        .select("name, phone, email, notes, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "inventory") {
      const { data } = await supabase
        .from("inventory_items")
        .select("name, quantity, unit, low_stock_threshold")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "appointments") {
      const { data } = await supabase
        .from("appointments")
        .select("title, starts_at, ends_at, notes, customer_id, prospect_id")
        .eq("workspace_id", workspaceId)
        .order("starts_at")
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    return { error: "Module Business OS inconnu." };
  }

  return runCrmTool(workspaceId, name, input);
}

async function runCrmTool(workspaceId: string, name: string, input: Record<string, unknown>) {
  const supabase = await createClient();

  if (name === "get_my_business_profile") {
    const { data } = await supabase
      .from("business_profiles")
      .select("company_name, website, offer_description, audience, tone, signature, agent_instruction")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return data ?? { error: "Profil entreprise introuvable — onboarding non terminé." };
  }

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
    if (typeof input.status === "string" && isValidProspectStatus(input.status)) {
      query = query.eq("status", input.status);
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

function buildSystemPrompt(plan: Plan): string {
  let prompt =
    "Tu es NOVA, l'assistant commercial de ProspectFlow OS. Réponds en français, de façon concise et concrète. " +
    "Utilise TOUJOURS un outil pour obtenir des données réelles avant de répondre à une question sur les prospects, " +
    "le CRM ou des statistiques — ne devine et n'invente jamais un chiffre ou un nom d'entreprise. " +
    "Si une donnée n'est pas disponible via tes outils, dis-le clairement plutôt que d'inventer une réponse. " +
    "Pour rédiger un email, consulte TOUJOURS get_my_business_profile (l'entreprise qui envoie) ET get_prospect " +
    "(le destinataire) avant d'écrire — jamais un email générique. Précise toujours qu'il doit être relu et validé " +
    "avant envoi : aucun envoi automatique n'existe encore dans ProspectFlow.";
  if (businessOsAtLeast(plan, "advanced")) {
    prompt +=
      " Ce workspace a le Business OS (plan Max) : utilise get_business_os_data pour répondre aux questions sur " +
      "les clients, le stock/les pièces ou les rendez-vous/interventions métier.";
  }
  return prompt;
}

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

  const plan = await getWorkspacePlan(workspaceId);
  try {
    await assertNovaQuota(workspaceId, plan);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Quota NOVA atteint." };
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round < 4; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(plan),
      tools: buildTools(plan),
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((b) => b.type === "text");
      await incrementNovaUsage(workspaceId);
      return { reply: textBlock && "text" in textBlock ? textBlock.text : "" };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = await runTool(workspaceId, plan, block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { error: "NOVA n'a pas pu conclure après plusieurs appels d'outils — reformulez votre question." };
}
