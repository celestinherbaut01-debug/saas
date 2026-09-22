"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { getEntitlements } from "@/lib/entitlements";
import { getCachedBusinessOsProfile } from "@/lib/session";
import { assertQuota, getUsage, incrementUsage } from "@/lib/quota";
import { isValidProspectStatus } from "@/lib/crm-status";
import {
  type SupabaseServerClient,
  loadCustomers,
  loadDocuments,
  loadProspects,
  loadParts,
  loadInventoryItems,
  loadRepairOrders,
  loadInterventions,
  loadContracts,
  loadClientSites,
  loadPurchaseOrders,
  loadAppointments,
} from "@/lib/business-os-data";
import { buildSnapshotMetrics, type SnapshotInputs } from "@/lib/business-twin/snapshot";
import { generateScenarios } from "@/lib/business-twin/scenarios";
import { buildPlan, type PlanBuilderContext } from "@/lib/business-twin/plan-builder";
import { assessMissionRisk, computeBlockers } from "@/lib/business-twin/mission-risk";
import { GOAL_CATALOG, goalTemplate } from "@/lib/business-twin/goals";
import { computeFingerprint } from "@/lib/business-twin/fingerprint";
import type { GoalType, ScenarioKey, ScenarioResult, TypedProspect, DataField } from "@/lib/business-twin/types";

// PROSPECTFLOW BUSINESS TWIN — server actions. Toute la logique de calcul
// (snapshot/scénarios/plan) reste dans lib/business-twin/*.ts (pur,
// testable sans réseau) ; ce fichier se limite à charger les vraies données
// (via lib/business-os-data.ts), appliquer le gating par plan, et persister
// le résultat. Aucun envoi externe réel (email/SMS/campagne) — tout reste
// "préparé", jamais "envoyé" (voir mission_actions.prepared_content).

async function assertMember(supabase: SupabaseServerClient, workspaceId: string): Promise<{ error: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Vous n'êtes pas membre de ce workspace." };
  return null;
}

function revalidateBusinessTwinPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/business-os");
  revalidatePath("/missions");
}

// ---------------------------------------------------------------------------
// SITUATION — charge les données brutes nécessaires au snapshot ET au plan-
// builder, selon la verticale réelle du workspace. Même esprit que
// collectBusinessOsOpportunities dans lib/actions/nova-opportunities.ts,
// mais produit des tableaux bruts (pas des Opportunity agrégées).
// ---------------------------------------------------------------------------
interface RawContext {
  vertical: Awaited<ReturnType<typeof getCachedBusinessOsProfile>>["vertical"];
  companyName: string;
  city: string;
  customers: { id: string; name: string }[];
  documents: PlanBuilderContext["documents"];
  prospects: TypedProspect[] | null;
  lowStockItems: { quantity: number; low_stock_threshold: number | null }[];
  scheduledDates: string[];
  renewalDates: { date: string }[];
}

async function loadRawContext(supabase: SupabaseServerClient, workspaceId: string, canSeeAcquisition: boolean): Promise<RawContext> {
  const profile = await getCachedBusinessOsProfile(workspaceId);
  const vertical = profile.vertical;

  const [{ data: bizProfile }, customerRows, documentRows, prospectRows] = await Promise.all([
    supabase.from("business_profiles").select("company_name, city").eq("workspace_id", workspaceId).maybeSingle(),
    loadCustomers(supabase, workspaceId),
    loadDocuments(supabase, workspaceId),
    canSeeAcquisition ? loadProspects(supabase, workspaceId) : Promise.resolve(null),
  ]);

  const customers = customerRows.map((c) => ({ id: c.id, name: c.name }));
  const documents = documentRows.map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    status: d.status,
    issued_at: d.issued_at,
    due_at: d.due_at,
    paid_at: d.paid_at,
    number: d.number,
    customer_id: d.customer_id,
    total_ttc: d.total_ttc,
  }));

  let prospects: TypedProspect[] | null = null;
  if (prospectRows) {
    prospects = [];
    for (const p of prospectRows) {
      if (isValidProspectStatus(p.status)) prospects.push({ id: p.id, company_name: p.company_name, quality_score: p.quality_score, status: p.status });
    }
  }

  let lowStockItems: { quantity: number; low_stock_threshold: number | null }[] = [];
  let scheduledDates: string[] = [];
  let renewalDates: { date: string }[] = [];

  if (vertical === "garage") {
    const [parts, repairOrders] = await Promise.all([loadParts(supabase, workspaceId), loadRepairOrders(supabase, workspaceId)]);
    lowStockItems = parts.map((p) => ({ quantity: p.quantity, low_stock_threshold: p.low_stock_threshold }));
    const activeStatuses = new Set(["diagnostic", "quote", "accepted", "in_progress", "waiting_parts"]);
    scheduledDates = repairOrders.filter((r) => r.scheduled_at && activeStatuses.has(r.status)).map((r) => r.scheduled_at as string);
  } else if (vertical === "cleaning") {
    const [inventory, interventions, contracts] = await Promise.all([
      loadInventoryItems(supabase, workspaceId),
      loadInterventions(supabase, workspaceId),
      loadContracts(supabase, workspaceId),
    ]);
    lowStockItems = inventory.map((i) => ({ quantity: i.quantity, low_stock_threshold: i.low_stock_threshold }));
    scheduledDates = interventions.filter((i) => i.status === "planned").map((i) => i.scheduled_at);
    renewalDates = contracts.filter((c) => c.renewal_date != null).map((c) => ({ date: c.renewal_date as string }));
  } else if (vertical === "agency") {
    const sites = await loadClientSites(supabase, workspaceId);
    for (const s of sites) {
      if (s.domain_renewal_date) renewalDates.push({ date: s.domain_renewal_date });
      if (s.hosting_renewal_date) renewalDates.push({ date: s.hosting_renewal_date });
    }
  } else if (vertical === "restaurant") {
    const [inventory, appointments] = await Promise.all([loadInventoryItems(supabase, workspaceId), loadAppointments(supabase, workspaceId)]);
    lowStockItems = inventory.map((i) => ({ quantity: i.quantity, low_stock_threshold: i.low_stock_threshold }));
    scheduledDates = appointments.map((a) => a.starts_at);
    void loadPurchaseOrders; // réservé pour l'objectif "écouler un stock" — pas encore de règle déterministe (voir scenarios.ts)
  } else {
    const inventory = await loadInventoryItems(supabase, workspaceId);
    lowStockItems = inventory.map((i) => ({ quantity: i.quantity, low_stock_threshold: i.low_stock_threshold }));
  }

  return {
    vertical,
    companyName: bizProfile?.company_name || "Votre entreprise",
    city: bizProfile?.city || "",
    customers,
    documents,
    prospects,
    lowStockItems,
    scheduledDates,
    renewalDates,
  };
}

// ---------------------------------------------------------------------------
// Statut Business Twin pour ce workspace — piloté par l'UI (dashboard) pour
// savoir si le bouton "Atteindre un objectif" doit proposer une simulation
// d'essai (Free) ou une vraie mission persistante.
// ---------------------------------------------------------------------------
export interface BusinessTwinStatus {
  canCreateMission: boolean;
  maxActiveMissions: number;
  activeMissionsCount: number;
  scenarioRunsUsed: number;
  scenarioRunsLimit: number;
  goals: typeof GOAL_CATALOG;
}

export async function getBusinessTwinStatus(workspaceId: string): Promise<BusinessTwinStatus> {
  const supabase = await createClient();
  const plan = await getWorkspacePlan(workspaceId);
  const ent = getEntitlements(plan);

  const [{ count: activeMissionsCount }, scenarioUsage] = await Promise.all([
    supabase.from("missions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
    getUsage(workspaceId, "scenario_runs", plan),
  ]);

  return {
    canCreateMission: ent.businessTwinMaxActiveMissions > 0 && (activeMissionsCount ?? 0) < ent.businessTwinMaxActiveMissions,
    maxActiveMissions: ent.businessTwinMaxActiveMissions,
    activeMissionsCount: activeMissionsCount ?? 0,
    scenarioRunsUsed: scenarioUsage.used,
    scenarioRunsLimit: scenarioUsage.limit,
    goals: GOAL_CATALOG,
  };
}

export interface SimulationResult {
  scenarioRunId: string;
  snapshotId: string;
  scenarios: (ScenarioResult & { id: string; isRepeat: boolean; firstSeenAt: string | null })[];
}

/**
 * ANTI-RÉPÉTITION — vérifie si ce fingerprint a déjà été vu pour ce
 * workspace (voir 0032_business_twin_anti_repetition.sql) et met à jour le
 * registre. Ne bloque JAMAIS l'enregistrement du scénario lui-même (il
 * reste consultable dans son scenario_run) — seule sa présentation change
 * côté UI ("reste valable" au lieu de "nouveau").
 */
async function registerFingerprint(
  supabase: SupabaseServerClient,
  workspaceId: string,
  fingerprint: string,
  goalType: GoalType,
  lever: string,
  label: string,
): Promise<{ isRepeat: boolean; firstSeenAt: string }> {
  const { data: existing } = await supabase
    .from("recommendation_fingerprints")
    .select("first_seen_at, times_seen")
    .eq("workspace_id", workspaceId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    await supabase
      .from("recommendation_fingerprints")
      .update({ last_seen_at: now, times_seen: existing.times_seen + 1 })
      .eq("workspace_id", workspaceId)
      .eq("fingerprint", fingerprint);
    return { isRepeat: true, firstSeenAt: existing.first_seen_at };
  }

  await supabase.from("recommendation_fingerprints").insert({
    workspace_id: workspaceId,
    fingerprint,
    goal_type: goalType,
    lever,
    label,
    first_seen_at: now,
    last_seen_at: now,
    times_seen: 1,
  });
  return { isRepeat: false, firstSeenAt: now };
}

/**
 * Cœur commun de SITUATION + SIMULATION : recalcule un snapshot à partir des
 * données ACTUELLES et génère/persiste les scénarios. Utilisé aussi bien
 * pour une première simulation (missionId=null) que pour un AJUSTEMENT
 * (missionId renseigné — voir runAdjustmentSimulation) : dans les deux cas,
 * rien n'est réutilisé de l'ancien snapshot, tout est recalculé "en direct".
 */
async function computeAndPersistScenarios(
  supabase: SupabaseServerClient,
  workspaceId: string,
  ent: ReturnType<typeof getEntitlements>,
  input: { goalType: GoalType; goalLabel: string },
  missionId: string | null,
): Promise<{ result: SimulationResult } | { error: string }> {
  const raw = await loadRawContext(supabase, workspaceId, ent.canSeeAcquisitionOpportunities);

  const snapshotInputs: SnapshotInputs = {
    vertical: raw.vertical,
    prospects: raw.prospects,
    documents: raw.documents.map((d) => ({
      doc_type: d.doc_type,
      status: d.status,
      issued_at: d.issued_at,
      due_at: d.due_at,
      paid_at: d.paid_at ?? null,
      total_ttc: d.total_ttc,
      customer_id: d.customer_id,
    })),
    customers: raw.customers,
    lowStockItems: raw.lowStockItems,
    scheduledDates: raw.scheduledDates,
    renewalDates: raw.renewalDates,
  };
  const metrics = buildSnapshotMetrics(snapshotInputs);

  let scenarios = generateScenarios(input.goalType, metrics);
  if (!ent.businessTwinAdvancedScenarios) {
    scenarios = scenarios.filter((s) => s.key !== "alternative");
  }

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("business_twin_snapshots")
    .insert({ workspace_id: workspaceId, vertical: raw.vertical, metrics: metrics as unknown as Record<string, unknown> })
    .select("id")
    .single();
  if (snapshotError || !snapshotRow) return { error: `Échec de l'enregistrement du snapshot : ${snapshotError?.message}` };

  const { data: runRow, error: runError } = await supabase
    .from("scenario_runs")
    .insert({ workspace_id: workspaceId, mission_id: missionId, snapshot_id: snapshotRow.id, goal_type: input.goalType, prompt: input.goalLabel })
    .select("id")
    .single();
  if (runError || !runRow) return { error: `Échec de l'enregistrement de la simulation : ${runError?.message}` };

  const scenariosWithIds: (ScenarioResult & { id: string; isRepeat: boolean; firstSeenAt: string | null })[] = [];
  for (const scenario of scenarios) {
    // "do_nothing" n'est pas une recommandation au sens du point 3 — pas de
    // fingerprint à suivre pour "ne rien faire", qui n'est jamais "répété"
    // au sens où l'utilisateur l'entend.
    const fingerprint = scenario.lever === "do_nothing" ? null : computeFingerprint(workspaceId, input.goalType, scenario.fingerprintSeed);
    const repeatInfo = fingerprint ? await registerFingerprint(supabase, workspaceId, fingerprint, input.goalType, scenario.lever, scenario.label) : null;

    const { data: resultRow, error: resultError } = await supabase
      .from("scenario_results")
      .insert({
        workspace_id: workspaceId,
        scenario_run_id: runRow.id,
        key: scenario.key,
        label: scenario.label,
        description: scenario.description,
        effort: scenario.effort,
        confidence: scenario.confidence,
        confidence_explanation: scenario.confidenceExplanation,
        qualitative_impact: scenario.qualitativeImpact,
        is_recommended: scenario.isRecommended,
        plan_preview: scenario.planPreview,
        lever: scenario.lever,
        signal_category: scenario.signalCategory,
        fingerprint,
        is_repeat: repeatInfo?.isRepeat ?? false,
        first_seen_at: repeatInfo?.firstSeenAt ?? null,
      })
      .select("id")
      .single();
    if (resultError || !resultRow) return { error: `Échec de l'enregistrement d'un scénario : ${resultError?.message}` };

    if (scenario.assumptions.length > 0) {
      await supabase.from("scenario_assumptions").insert(
        scenario.assumptions.map((a) => ({
          workspace_id: workspaceId,
          scenario_result_id: resultRow.id,
          kind: a.kind,
          label: a.label,
          explanation: a.explanation,
        })),
      );
    }

    scenariosWithIds.push({ ...scenario, id: resultRow.id, isRepeat: repeatInfo?.isRepeat ?? false, firstSeenAt: repeatInfo?.firstSeenAt ?? null });
  }

  await incrementUsage(workspaceId, "scenario_runs");

  return { result: { scenarioRunId: runRow.id, snapshotId: snapshotRow.id, scenarios: scenariosWithIds } };
}

/**
 * SIMULATION — calcule le snapshot + les scénarios pour un objectif, et les
 * persiste SANS créer de mission : explorer un objectif ne doit jamais
 * engager automatiquement une mission (voir createMissionFromScenario, une
 * étape explicite séparée).
 */
export async function runSimulation(
  workspaceId: string,
  input: { goalType: GoalType; goalLabel: string },
): Promise<{ result: SimulationResult } | { error: string }> {
  const supabase = await createClient();
  const memberError = await assertMember(supabase, workspaceId);
  if (memberError) return memberError;

  const plan = await getWorkspacePlan(workspaceId);
  const ent = getEntitlements(plan);

  try {
    await assertQuota(workspaceId, "scenario_runs", plan);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Quota de simulations atteint." };
  }

  return computeAndPersistScenarios(supabase, workspaceId, ent, input, null);
}

/**
 * AJUSTEMENT — recalcule un nouveau snapshot + de nouveaux scénarios pour
 * une mission EXISTANTE, à partir des données actuelles (pas de celles
 * utilisées à la création). Ne modifie rien tant que l'utilisateur n'a pas
 * explicitement choisi un scénario (voir addScenarioToMission) : ajuster
 * n'écrase jamais silencieusement le plan en cours.
 */
export async function runAdjustmentSimulation(workspaceId: string, missionId: string): Promise<{ result: SimulationResult } | { error: string }> {
  const supabase = await createClient();
  const memberError = await assertMember(supabase, workspaceId);
  if (memberError) return memberError;

  const { data: mission } = await supabase.from("missions").select("goal_type, goal_label").eq("id", missionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!mission) return { error: "Mission introuvable." };

  const plan = await getWorkspacePlan(workspaceId);
  const ent = getEntitlements(plan);

  try {
    await assertQuota(workspaceId, "scenario_runs", plan);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Quota de simulations atteint." };
  }

  const outcome = await computeAndPersistScenarios(supabase, workspaceId, ent, { goalType: mission.goal_type, goalLabel: mission.goal_label }, missionId);
  if (!("error" in outcome)) {
    await supabase
      .from("mission_events")
      .insert({ workspace_id: workspaceId, mission_id: missionId, event_type: "progress_update", detail: "Nouvelle simulation lancée pour ajuster le plan." });
  }
  return outcome;
}

/**
 * PLAN + ACTIONS — transforme un scénario CHOISI en mission persistante et
 * en mission_actions concrètes. Recharge des données FRAÎCHES (voir
 * plan-builder.ts) plutôt que de réutiliser celles de la simulation, qui
 * peuvent être obsolètes entre-temps.
 */
export async function createMissionFromScenario(
  workspaceId: string,
  params: {
    scenarioRunId: string;
    scenarioResultId: string;
    scenarioKey: ScenarioKey;
    /** Levier réel choisi (ScenarioResult.lever) — pilote QUELLES actions le plan-builder génère, voir lib/business-twin/plan-builder.ts. */
    lever: string;
    goalType: GoalType;
    goalLabel: string;
    goalTargetValue?: number | null;
    goalTargetUnit?: string | null;
    deadline?: string | null;
  },
): Promise<{ missionId: string } | { error: string }> {
  const supabase = await createClient();
  const memberError = await assertMember(supabase, workspaceId);
  if (memberError) return memberError;

  const plan = await getWorkspacePlan(workspaceId);
  const ent = getEntitlements(plan);

  if (ent.businessTwinMaxActiveMissions === 0) {
    return { error: "Les missions persistantes ne sont pas incluses sur votre plan — passez à un plan payant pour créer une mission." };
  }
  const { count: activeCount } = await supabase.from("missions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active");
  if ((activeCount ?? 0) >= ent.businessTwinMaxActiveMissions) {
    return { error: `Limite de ${ent.businessTwinMaxActiveMissions} mission(s) active(s) atteinte pour votre plan — terminez ou abandonnez une mission avant d'en créer une nouvelle.` };
  }

  const { data: runRow } = await supabase.from("scenario_runs").select("snapshot_id").eq("id", params.scenarioRunId).eq("workspace_id", workspaceId).maybeSingle();

  const { data: missionRow, error: missionError } = await supabase
    .from("missions")
    .insert({
      workspace_id: workspaceId,
      goal_type: params.goalType,
      goal_label: params.goalLabel,
      goal_target_value: params.goalTargetValue ?? null,
      goal_target_unit: params.goalTargetUnit ?? null,
      deadline: params.deadline ?? null,
      status: "active",
      snapshot_id: runRow?.snapshot_id ?? null,
      chosen_scenario_result_id: params.scenarioResultId,
    })
    .select("id")
    .single();
  if (missionError || !missionRow) return { error: `Échec de la création de la mission : ${missionError?.message}` };

  await supabase.from("scenario_runs").update({ mission_id: missionRow.id, applied: true }).eq("id", params.scenarioRunId);

  const raw = await loadRawContext(supabase, workspaceId, ent.canSeeAcquisitionOpportunities);
  const planContext: PlanBuilderContext = {
    goalType: params.goalType,
    lever: params.lever,
    companyName: raw.companyName,
    vertical: raw.vertical,
    city: raw.city,
    prospects: raw.prospects ?? [],
    documents: raw.documents,
    customers: raw.customers,
  };
  const drafts = buildPlan(planContext);

  if (drafts.length > 0) {
    await supabase.from("mission_actions").insert(
      drafts.map((d, i) => ({
        workspace_id: workspaceId,
        mission_id: missionRow.id,
        step_order: i,
        action_type: d.actionType,
        title: d.title,
        reason: d.reason,
        status: "proposed" as const,
        target_ref: d.targetRef ?? null,
        // "Actions préparées" (contenu réellement rédigé) reste un avantage
        // Pro/Advanced+ — les plans plus simples gardent la liste de tâches,
        // sans le contenu prêt à copier-coller (voir businessTwinPreparedActions).
        prepared_content: ent.businessTwinPreparedActions ? (d.preparedContent ?? null) : null,
      })),
    );
  }

  await supabase.from("mission_events").insert([
    { workspace_id: workspaceId, mission_id: missionRow.id, event_type: "created", detail: params.goalLabel },
    { workspace_id: workspaceId, mission_id: missionRow.id, event_type: "scenario_chosen", detail: `Levier choisi : ${params.lever}` },
    { workspace_id: workspaceId, mission_id: missionRow.id, event_type: "plan_applied", detail: `${drafts.length} action(s) préparée(s).` },
  ]);

  revalidateBusinessTwinPaths();
  return { missionId: missionRow.id };
}

/**
 * AJUSTEMENT (suite) — applique un scénario issu d'un run d'AJUSTEMENT à une
 * mission EXISTANTE : ajoute de nouvelles mission_actions à la suite du
 * plan actuel (jamais de suppression des actions déjà en cours), et met à
 * jour le snapshot/scénario de référence de la mission. Contrairement à
 * createMissionFromScenario, ne crée aucune nouvelle mission.
 */
export async function addScenarioToMission(
  workspaceId: string,
  params: { missionId: string; scenarioRunId: string; scenarioResultId: string; scenarioKey: ScenarioKey; lever: string },
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const memberError = await assertMember(supabase, workspaceId);
  if (memberError) return { error: memberError.error };

  const { data: mission } = await supabase.from("missions").select("id, goal_type").eq("id", params.missionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!mission) return { error: "Mission introuvable." };

  const { data: runRow } = await supabase
    .from("scenario_runs")
    .select("id, snapshot_id, mission_id")
    .eq("id", params.scenarioRunId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!runRow || runRow.mission_id !== params.missionId) return { error: "Cette simulation ne correspond pas à cette mission." };

  const plan = await getWorkspacePlan(workspaceId);
  const ent = getEntitlements(plan);

  const { count: existingCount } = await supabase.from("mission_actions").select("id", { count: "exact", head: true }).eq("mission_id", params.missionId);
  const startOrder = existingCount ?? 0;

  const raw = await loadRawContext(supabase, workspaceId, ent.canSeeAcquisitionOpportunities);
  const planContext: PlanBuilderContext = {
    goalType: mission.goal_type,
    lever: params.lever,
    companyName: raw.companyName,
    vertical: raw.vertical,
    city: raw.city,
    prospects: raw.prospects ?? [],
    documents: raw.documents,
    customers: raw.customers,
  };
  const drafts = buildPlan(planContext);

  if (drafts.length > 0) {
    await supabase.from("mission_actions").insert(
      drafts.map((d, i) => ({
        workspace_id: workspaceId,
        mission_id: params.missionId,
        step_order: startOrder + i,
        action_type: d.actionType,
        title: d.title,
        reason: d.reason,
        status: "proposed" as const,
        target_ref: d.targetRef ?? null,
        prepared_content: ent.businessTwinPreparedActions ? (d.preparedContent ?? null) : null,
      })),
    );
  }

  await Promise.all([
    supabase.from("missions").update({ snapshot_id: runRow.snapshot_id, chosen_scenario_result_id: params.scenarioResultId }).eq("id", params.missionId),
    supabase.from("scenario_runs").update({ applied: true }).eq("id", params.scenarioRunId),
    supabase.from("mission_events").insert([
      { workspace_id: workspaceId, mission_id: params.missionId, event_type: "scenario_chosen", detail: `Ajustement — levier choisi : ${params.lever}` },
      { workspace_id: workspaceId, mission_id: params.missionId, event_type: "plan_applied", detail: `${drafts.length} nouvelle(s) action(s) ajoutée(s) au plan.` },
    ]),
  ]);

  revalidateBusinessTwinPaths();
  revalidatePath(`/missions/${params.missionId}`);
  return { ok: true };
}

export interface MissionSummary {
  id: string;
  goalLabel: string;
  goalType: GoalType;
  status: string;
  deadline: string | null;
  totalActions: number;
  doneActions: number;
  risk: ReturnType<typeof assessMissionRisk>;
}

export async function listMissions(workspaceId: string): Promise<MissionSummary[]> {
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("missions")
    .select("id, goal_label, goal_type, status, deadline")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (!missions || missions.length === 0) return [];

  const { data: actions } = await supabase
    .from("mission_actions")
    .select("mission_id, status")
    .in(
      "mission_id",
      missions.map((m) => m.id),
    );

  return missions.map((m) => {
    const missionActions = (actions ?? []).filter((a) => a.mission_id === m.id);
    const doneActions = missionActions.filter((a) => a.status === "done").length;
    return {
      id: m.id,
      goalLabel: m.goal_label,
      goalType: m.goal_type,
      status: m.status,
      deadline: m.deadline,
      totalActions: missionActions.length,
      doneActions,
      risk: assessMissionRisk({ deadline: m.deadline, totalActions: missionActions.length, doneActions }),
    };
  });
}

export interface MissionActionView {
  id: string;
  actionType: string;
  title: string;
  reason: string;
  status: string;
  preparedContent: Record<string, unknown> | null;
  dueAt: string | null;
}

export interface MissionDetail {
  id: string;
  goalLabel: string;
  goalType: GoalType;
  goalTargetValue: number | null;
  goalTargetUnit: string | null;
  status: string;
  deadline: string | null;
  actions: MissionActionView[];
  events: { eventType: string; detail: string; createdAt: string }[];
  risk: ReturnType<typeof assessMissionRisk>;
  blockers: string[];
  snapshotMetrics: Record<string, DataField<unknown>> | null;
}

export async function getMissionDetail(workspaceId: string, missionId: string): Promise<MissionDetail | { error: string }> {
  const supabase = await createClient();
  const { data: mission } = await supabase.from("missions").select("*").eq("id", missionId).eq("workspace_id", workspaceId).maybeSingle();
  if (!mission) return { error: "Mission introuvable." };

  const [{ data: actions }, { data: events }, { data: snapshot }] = await Promise.all([
    supabase.from("mission_actions").select("*").eq("mission_id", missionId).order("step_order"),
    supabase.from("mission_events").select("event_type, detail, created_at").eq("mission_id", missionId).order("created_at", { ascending: false }),
    mission.snapshot_id ? supabase.from("business_twin_snapshots").select("metrics").eq("id", mission.snapshot_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const actionViews: MissionActionView[] = (actions ?? []).map((a) => ({
    id: a.id,
    actionType: a.action_type,
    title: a.title,
    reason: a.reason,
    status: a.status,
    preparedContent: a.prepared_content,
    dueAt: a.due_at,
  }));
  const doneActions = actionViews.filter((a) => a.status === "done").length;

  return {
    id: mission.id,
    goalLabel: mission.goal_label,
    goalType: mission.goal_type,
    goalTargetValue: mission.goal_target_value,
    goalTargetUnit: mission.goal_target_unit,
    status: mission.status,
    deadline: mission.deadline,
    actions: actionViews,
    events: (events ?? []).map((e) => ({ eventType: e.event_type, detail: e.detail, createdAt: e.created_at })),
    risk: assessMissionRisk({ deadline: mission.deadline, totalActions: actionViews.length, doneActions }),
    blockers: computeBlockers((actions ?? []).map((a) => ({ id: a.id, title: a.title, status: a.status, created_at: a.created_at }))),
    snapshotMetrics: (snapshot?.metrics as Record<string, DataField<unknown>> | undefined) ?? null,
  };
}

/**
 * RÉSULTATS — marque une action faite/ignorée et enregistre l'issue (point
 * 15 : on enregistre, on n'entraîne rien en V1). `result`/`amount_eur`
 * restent NULL tant qu'aucune donnée réelle ne les remplit — jamais estimés
 * ici.
 */
export async function setMissionActionStatus(
  workspaceId: string,
  actionId: string,
  status: "done" | "skipped",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const memberError = await assertMember(supabase, workspaceId);
  if (memberError) return { ok: false, error: memberError.error };

  const { data: action, error: fetchError } = await supabase
    .from("mission_actions")
    .select("id, mission_id, title")
    .eq("id", actionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (fetchError || !action) return { ok: false, error: "Action introuvable." };

  const { error: updateError } = await supabase.from("mission_actions").update({ status }).eq("id", actionId);
  if (updateError) return { ok: false, error: updateError.message };

  await Promise.all([
    supabase.from("action_outcomes").insert({
      workspace_id: workspaceId,
      mission_action_id: actionId,
      accepted: status === "done",
      accepted_at: new Date().toISOString(),
    }),
    supabase.from("mission_events").insert({
      workspace_id: workspaceId,
      mission_id: action.mission_id,
      event_type: status === "done" ? "action_done" : "action_skipped",
      detail: action.title,
    }),
  ]);

  revalidateBusinessTwinPaths();
  return { ok: true };
}

export async function goalLabelFor(goalType: GoalType): Promise<string> {
  return goalTemplate(goalType).buttonLabel;
}
