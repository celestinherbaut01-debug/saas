"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast, novaContexts, type Plan } from "@/lib/entitlements";
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

// NOVA Commercial : prospection, CRM, relances — suit l'accès Acquisition.
const COMMERCIAL_TOOLS = [
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

// NOVA Métier : données Business OS — suit l'accès Business OS (dès le
// niveau standard, voir novaContexts() dans lib/entitlements.ts).
const METIER_TOOL = {
  name: "get_business_os_data",
  description:
    "Business OS avancé : accède aux vraies données métier du workspace — clients, stock, rendez-vous, et selon " +
    "le métier : véhicules/ordres de réparation/pièces/techniciens/devis-factures (garage), sites/contrats/" +
    "interventions/incidents (nettoyage), projets/sites clients/tickets (agence), pertes/commandes/recettes " +
    "(restaurant). Jamais inventé — un module non pertinent pour ce workspace renvoie une liste vide.",
  input_schema: {
    type: "object" as const,
    properties: {
      module: {
        type: "string",
        enum: [
          "customers",
          "inventory",
          "appointments",
          "vehicles",
          "repair_orders",
          "parts",
          "technicians",
          "documents",
          "sites",
          "contracts",
          "interventions",
          "incidents",
          "projects",
          "client_sites",
          "tickets",
          "waste_log",
          "purchase_orders",
          "recipes",
        ],
        description:
          "customers = clients/sites (générique) ; inventory = stock/pièces/consommables (générique) ; " +
          "appointments = RDV/planning (générique) ; vehicles/repair_orders/parts/technicians/documents = garage " +
          "(parts = catalogue de pièces avec quantité en stock, technicians = équipe avec charge de travail réelle, " +
          "documents = devis/factures avec statut) ; sites/contracts/interventions/incidents = nettoyage " +
          "(interventions inclut le statut planned/done/missed et la note qualité, incidents inclut la gravité) ; " +
          "projects/client_sites/tickets = agence (client_sites inclut les dates d'expiration domaine/hébergement " +
          "et la prochaine maintenance, tickets inclut priorité/statut) ; waste_log/purchase_orders/recipes = " +
          "restaurant (purchase_orders inclut le statut draft/ordered/received, recipes inclut food_cost_percent " +
          "déjà calculé)",
      },
      limit: { type: "number", description: "Nombre max de résultats (défaut 20, max 50)" },
    },
    required: ["module"],
  },
};


function buildTools(plan: Plan) {
  const contexts = novaContexts(plan);
  return [
    ...(contexts.includes("commercial") ? COMMERCIAL_TOOLS : []),
    ...(contexts.includes("metier") ? [METIER_TOOL] : []),
  ];
}

async function runTool(workspaceId: string, plan: Plan, name: string, input: Record<string, unknown>) {
  if (name === "get_business_os_data") {
    if (!businessOsAtLeast(plan, "standard")) return { error: "NOVA connectée aux données Business OS : réservé aux plans avec Business OS." };
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
    if (osModule === "vehicles") {
      const { data } = await supabase
        .from("vehicles")
        .select("registration, make, model, year, mileage, notes")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "repair_orders") {
      const { data } = await supabase
        .from("repair_orders")
        .select("title, status, scheduled_at, completed_at, delivered_at, labor_cost, parts_cost, notes, vehicle_id, technician_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      const vehicleIds = [...new Set((data ?? []).map((r) => r.vehicle_id).filter((id): id is string => Boolean(id)))];
      const technicianIds = [...new Set((data ?? []).map((r) => r.technician_id).filter((id): id is string => Boolean(id)))];
      const [{ data: vehicles }, { data: techs }] = await Promise.all([
        vehicleIds.length > 0
          ? supabase.from("vehicles").select("id, registration, make, model").in("id", vehicleIds)
          : Promise.resolve({ data: [] }),
        technicianIds.length > 0
          ? supabase.from("team_members").select("id, name, role").in("id", technicianIds)
          : Promise.resolve({ data: [] }),
      ]);
      const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
      const techById = new Map((techs ?? []).map((t) => [t.id, t]));
      const results = (data ?? []).map(({ vehicle_id, technician_id, ...rest }) => ({
        ...rest,
        vehicle: vehicle_id ? vehicleById.get(vehicle_id) ?? null : null,
        technician: technician_id ? techById.get(technician_id) ?? null : null,
      }));
      return { count: results.length, results };
    }
    if (osModule === "parts") {
      const { data } = await supabase
        .from("parts")
        .select("name, reference, quantity, unit, low_stock_threshold, unit_cost, unit_price")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "technicians") {
      const { data: technicians } = await supabase
        .from("team_members")
        .select("id, name, role, active")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(limit);
      const { data: orders } = await supabase
        .from("repair_orders")
        .select("technician_id, status")
        .eq("workspace_id", workspaceId)
        .not("technician_id", "is", null);
      const activeStatuses = new Set(["diagnostic", "quote", "accepted", "in_progress", "waiting_parts"]);
      const results = (technicians ?? []).map((t) => ({
        ...t,
        active_repair_orders: (orders ?? []).filter((o) => o.technician_id === t.id && activeStatuses.has(o.status)).length,
      }));
      return { count: results.length, results };
    }
    if (osModule === "documents") {
      const { data } = await supabase
        .from("documents")
        .select("doc_type, status, number, total_ttc, issued_at, due_at, repair_order_id")
        .eq("workspace_id", workspaceId)
        .order("issued_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "sites") {
      const { data } = await supabase
        .from("sites")
        .select("name, address, notes")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "interventions") {
      const { data } = await supabase
        .from("interventions")
        .select("scheduled_at, completed_at, status, quality_rating, notes, site_id, team_member_id")
        .eq("workspace_id", workspaceId)
        .order("scheduled_at", { ascending: false })
        .limit(limit);
      const siteIds = [...new Set((data ?? []).map((i) => i.site_id).filter((id): id is string => Boolean(id)))];
      const teamIds = [...new Set((data ?? []).map((i) => i.team_member_id).filter((id): id is string => Boolean(id)))];
      const [{ data: sites }, { data: team }] = await Promise.all([
        siteIds.length > 0 ? supabase.from("sites").select("id, name").in("id", siteIds) : Promise.resolve({ data: [] }),
        teamIds.length > 0 ? supabase.from("team_members").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] }),
      ]);
      const siteById = new Map((sites ?? []).map((s) => [s.id, s.name]));
      const teamById = new Map((team ?? []).map((t) => [t.id, t.name]));
      const results = (data ?? []).map(({ site_id, team_member_id, ...rest }) => ({
        ...rest,
        site: site_id ? siteById.get(site_id) ?? null : null,
        team_member: team_member_id ? teamById.get(team_member_id) ?? null : null,
      }));
      return { count: results.length, results };
    }
    if (osModule === "incidents") {
      const { data } = await supabase
        .from("incidents")
        .select("title, severity, status, reported_at, resolved_at, notes")
        .eq("workspace_id", workspaceId)
        .order("reported_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "contracts") {
      const { data } = await supabase
        .from("contracts")
        .select("site_name, frequency, monthly_price, renewal_date, status, notes")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "projects") {
      const { data } = await supabase
        .from("projects")
        .select("name, project_type, status, deadline, budget, notes")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "client_sites") {
      const { data } = await supabase
        .from("client_sites")
        .select("domain_name, hosting_provider, domain_renewal_date, hosting_renewal_date, next_maintenance_at, monthly_price, status")
        .eq("workspace_id", workspaceId)
        .order("domain_renewal_date")
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "tickets") {
      const { data } = await supabase
        .from("tickets")
        .select("title, priority, status, created_at, resolved_at, notes")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "waste_log") {
      const { data } = await supabase
        .from("waste_log")
        .select("item_name, quantity, unit, reason, estimated_cost, logged_at")
        .eq("workspace_id", workspaceId)
        .order("logged_at", { ascending: false })
        .limit(limit);
      return { count: data?.length ?? 0, results: data ?? [] };
    }
    if (osModule === "purchase_orders") {
      const { data } = await supabase
        .from("purchase_orders")
        .select("status, total_cost, ordered_at, received_at, notes, supplier_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      const supplierIds = [...new Set((data ?? []).map((p) => p.supplier_id).filter((id): id is string => Boolean(id)))];
      const { data: suppliers } =
        supplierIds.length > 0 ? await supabase.from("suppliers").select("id, name").in("id", supplierIds) : { data: [] };
      const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
      const results = (data ?? []).map(({ supplier_id, ...rest }) => ({ ...rest, supplier: supplier_id ? supplierById.get(supplier_id) ?? null : null }));
      return { count: results.length, results };
    }
    if (osModule === "recipes") {
      const { data: recipes } = await supabase.from("recipes").select("id, name, selling_price, notes").eq("workspace_id", workspaceId).order("name").limit(limit);
      const recipeIds = (recipes ?? []).map((r) => r.id);
      const { data: ingredients } =
        recipeIds.length > 0
          ? await supabase.from("recipe_ingredients").select("recipe_id, item_name, quantity, unit_cost").in("recipe_id", recipeIds)
          : { data: [] };
      const results = (recipes ?? []).map((r) => {
        const lines = (ingredients ?? []).filter((i) => i.recipe_id === r.id);
        const cost = lines.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
        return {
          name: r.name,
          selling_price: r.selling_price,
          notes: r.notes,
          food_cost: cost,
          food_cost_percent: r.selling_price > 0 ? Math.round((cost / r.selling_price) * 100) : null,
        };
      });
      return { count: results.length, results };
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
  const contexts = novaContexts(plan);
  const hasCommercial = contexts.includes("commercial");
  const hasMetier = contexts.includes("metier");

  // L'identité de NOVA reflète ce que CE workspace a réellement payé —
  // jamais "assistant commercial" par défaut pour un client Business OS
  // seul (acquisitionLevel "none"), qui n'a ni prospects ni CRM à interroger.
  let prompt = hasCommercial && hasMetier
    ? "Tu es NOVA, l'assistant IA de ProspectFlow OS : à la fois NOVA Commercial (prospection, CRM, relances) et " +
      "NOVA Métier (gestion de l'activité). "
    : hasCommercial
      ? "Tu es NOVA Commercial, l'assistant IA de ProspectFlow OS dédié à la prospection et au CRM. "
      : "Tu es NOVA Métier, l'assistant IA de ProspectFlow OS dédié à la gestion de l'activité. ";

  prompt +=
    "Réponds en français, de façon concise et concrète. Utilise TOUJOURS un outil pour obtenir des données réelles " +
    "avant de répondre à une question sur le workspace — ne devine et n'invente jamais un chiffre ou un nom. Si une " +
    "donnée n'est pas disponible via tes outils, dis-le clairement plutôt que d'inventer une réponse.";

  if (hasCommercial) {
    prompt +=
      " Pour rédiger un email, consulte TOUJOURS get_my_business_profile (l'entreprise qui envoie) ET get_prospect " +
      "(le destinataire) avant d'écrire — jamais un email générique. Précise toujours qu'il doit être relu et " +
      "validé avant envoi : aucun envoi automatique n'existe encore dans ProspectFlow.";
  }

  if (hasMetier) {
    prompt +=
      " Ce workspace a le Business OS activé : utilise get_business_os_data pour répondre avec les vraies " +
      "données métier. Pour un garage, 'qui a rendez-vous bientôt ?' = module repair_orders, regarde scheduled_at " +
      "(pas de table appointments pour ce métier : le rendez-vous, c'est l'ordre de réparation planifié) ; 'quels " +
      "véhicules attendent une pièce ?' = module repair_orders, filtre " +
      "toi-même les résultats dont status = waiting_parts (chaque résultat inclut vehicle.registration) ; 'quels " +
      "produits sont en rupture ?' = module parts, repère toi-même les lignes où quantity <= low_stock_threshold ; " +
      "'quelle est la charge de chaque technicien ?' = module technicians (active_repair_orders déjà calculé) ; " +
      "'quels devis sont en attente ?' = module documents, doc_type = quote et status = sent. Pour le nettoyage : " +
      "contrats bientôt à renouveler = module contracts, statut ending_soon ; 'quelles interventions n'ont pas " +
      "d'équipe ?' = module interventions, filtre toi-même les résultats où team_member est null. Pour une agence " +
      "web : projets en maintenance = module projects ; 'quels domaines expirent bientôt ?' = module client_sites, " +
      "regarde domain_renewal_date/hosting_renewal_date ; tickets ouverts = module tickets, statut open/in_progress. " +
      "Pour un restaurant : pertes récentes = module waste_log ; commandes fournisseurs en attente = module " +
      "purchase_orders, statut ordered ; 'quel plat a le food cost le plus élevé ?' = module recipes, compare " +
      "food_cost_percent (déjà calculé, ne recalcule jamais toi-même). Pour tout métier, appointments donne les " +
      "rendez-vous/planning. N'appelle jamais un module qui n'a pas de sens pour ce métier ; s'il renvoie une " +
      "liste vide, dis-le plutôt que d'inventer une réponse.";
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
