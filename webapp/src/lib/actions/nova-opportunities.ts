"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { getEntitlements } from "@/lib/entitlements";
import { getCachedBusinessOsProfile } from "@/lib/session";
import { isValidProspectStatus, type ProspectStatus } from "@/lib/crm-status";
import {
  type SupabaseServerClient,
  loadProspects,
  loadCustomers,
  loadDocuments,
  loadParts,
  loadInventoryItems,
  loadRepairOrders,
  loadInterventions,
  loadContracts,
  loadClientSites,
  loadPurchaseOrders,
  loadAppointments,
} from "@/lib/business-os-data";
import {
  type Opportunity,
  type ActionLogEntry,
  detectPriorityProspects,
  detectUnansweredQuotes,
  detectOverdueInvoices,
  detectLowStock,
  detectInactiveCustomers,
  detectRenewalsUpcoming,
  detectUnderbooking,
  detectActivityDecline,
  sortByPriority,
  filterSnoozed,
} from "@/lib/nova-opportunities";

export interface OpportunitiesResult {
  opportunities: Opportunity[];
  /** Sert au dashboard/à la page /nova/actions pour distinguer "aucune opportunité" de "module pas encore accessible sur ce plan". */
  canSeeAcquisition: boolean;
  canSeeBusinessOs: boolean;
}

/**
 * Point d'entrée UNIQUE du moteur NOVA Growth Autopilot côté serveur :
 * charge les vraies données nécessaires (par module ET par verticale
 * Business OS), appelle les fonctions pures de lib/nova-opportunities.ts,
 * puis applique le statut fait/ignoré déjà en base (nova_action_log) avant
 * de renvoyer la liste triée par priorité. Rien n'est jamais stocké ici en
 * dehors de ce statut — les opportunités elles-mêmes sont recalculées à
 * chaque appel depuis les tables réelles.
 */
export async function getOpportunities(workspaceId: string): Promise<OpportunitiesResult> {
  const supabase = await createClient();
  const plan = await getWorkspacePlan(workspaceId);
  const ent = getEntitlements(plan);

  const opportunities: Opportunity[] = [];

  if (ent.canSeeAcquisitionOpportunities) {
    const prospects = await loadProspects(supabase, workspaceId);
    // `status` est un `string` côté Database générique : on ne garde que les
    // valeurs qui correspondent réellement à ProspectStatus plutôt que de
    // forcer le type avec `as`, une donnée corrompue ne doit jamais fausser
    // discrètement le calcul de priorité.
    const typedProspects: { quality_score: number; status: ProspectStatus }[] = [];
    for (const p of prospects) {
      if (isValidProspectStatus(p.status)) typedProspects.push({ quality_score: p.quality_score, status: p.status });
    }
    const opp = detectPriorityProspects(typedProspects);
    if (opp) opportunities.push(opp);
  }

  if (ent.canSeeBusinessOsOpportunities) {
    await collectBusinessOsOpportunities(supabase, workspaceId, opportunities);
  }

  if (opportunities.length === 0) {
    return { opportunities: [], canSeeAcquisition: ent.canSeeAcquisitionOpportunities, canSeeBusinessOs: ent.canSeeBusinessOsOpportunities };
  }

  const { data: logRows } = await supabase
    .from("nova_action_log")
    .select("opportunity_key, status, updated_at")
    .eq("workspace_id", workspaceId);
  const log = new Map<string, ActionLogEntry>(
    (logRows ?? []).map((r) => [r.opportunity_key, { status: r.status, updatedAt: r.updated_at }]),
  );

  return {
    opportunities: sortByPriority(filterSnoozed(opportunities, log)),
    canSeeAcquisition: ent.canSeeAcquisitionOpportunities,
    canSeeBusinessOs: ent.canSeeBusinessOsOpportunities,
  };
}

/**
 * Charge les données Business OS selon la verticale réelle du workspace
 * (garage/nettoyage/agence/restaurant/générique) — chaque verticale a son
 * propre schéma (voir lib/business-os.ts), donc pas de requête générique
 * possible. Un module absent pour une verticale (ex. pas de "créneaux" pour
 * une agence web) est simplement omis, jamais simulé. Toutes les lectures
 * passent par lib/business-os-data.ts (voir son en-tête) — plus de requête
 * `.from(...).select(...)` écrite ici directement.
 */
async function collectBusinessOsOpportunities(
  supabase: SupabaseServerClient,
  workspaceId: string,
  opportunities: Opportunity[],
): Promise<void> {
  const profile = await getCachedBusinessOsProfile(workspaceId);
  const vertical = profile.vertical;

  // documents est vide (jamais absent) pour le restaurant, qui n'utilise pas
  // cette table — les fonctions de détection ci-dessous renvoient alors
  // simplement `null`, sans branche spéciale à maintenir.
  const [customers, documents] = await Promise.all([loadCustomers(supabase, workspaceId), loadDocuments(supabase, workspaceId)]);

  const unanswered = detectUnansweredQuotes(documents);
  if (unanswered) opportunities.push(unanswered);
  const overdue = detectOverdueInvoices(documents);
  if (overdue) opportunities.push(overdue);
  const inactive = detectInactiveCustomers(customers, documents);
  if (inactive) opportunities.push(inactive);
  const decline = detectActivityDecline(
    documents.map((d) => d.issued_at),
    "Devis & factures",
  );
  if (decline) opportunities.push(decline);

  if (vertical === "garage") {
    const [parts, repairOrders] = await Promise.all([loadParts(supabase, workspaceId), loadRepairOrders(supabase, workspaceId)]);
    const low = detectLowStock(parts);
    if (low) opportunities.push(low);

    const activeStatuses = new Set(["diagnostic", "quote", "accepted", "in_progress", "waiting_parts"]);
    const scheduled = repairOrders.filter((r) => r.scheduled_at && activeStatuses.has(r.status)).map((r) => r.scheduled_at as string);
    const underbooking = detectUnderbooking(scheduled, "Atelier");
    if (underbooking) opportunities.push(underbooking);
    return;
  }

  if (vertical === "cleaning") {
    const [inventory, interventions, contracts] = await Promise.all([
      loadInventoryItems(supabase, workspaceId),
      loadInterventions(supabase, workspaceId),
      loadContracts(supabase, workspaceId),
    ]);
    const low = detectLowStock(inventory);
    if (low) opportunities.push(low);

    const scheduled = interventions.filter((i) => i.status === "planned").map((i) => i.scheduled_at);
    const underbooking = detectUnderbooking(scheduled, "Planning interventions");
    if (underbooking) opportunities.push(underbooking);

    const renewals = contracts
      .filter((c): c is typeof c & { renewal_date: string } => c.renewal_date != null)
      .map((c) => ({ label: c.site_name, date: c.renewal_date }));
    const renewalOpp = detectRenewalsUpcoming(renewals);
    if (renewalOpp) opportunities.push(renewalOpp);
    return;
  }

  if (vertical === "agency") {
    const sites = await loadClientSites(supabase, workspaceId);
    const renewals: { label: string; date: string }[] = [];
    for (const s of sites) {
      if (s.domain_renewal_date) renewals.push({ label: `Domaine ${s.domain_name}`, date: s.domain_renewal_date });
      if (s.hosting_renewal_date) renewals.push({ label: `Hébergement ${s.domain_name}`, date: s.hosting_renewal_date });
    }
    const renewalOpp = detectRenewalsUpcoming(renewals);
    if (renewalOpp) opportunities.push(renewalOpp);
    return;
  }

  if (vertical === "restaurant") {
    const [inventory, appointments, purchaseOrders] = await Promise.all([
      loadInventoryItems(supabase, workspaceId),
      loadAppointments(supabase, workspaceId),
      loadPurchaseOrders(supabase, workspaceId),
    ]);
    const low = detectLowStock(inventory);
    if (low) opportunities.push(low);

    const underbooking = detectUnderbooking(appointments.map((a) => a.starts_at), "Réservations");
    if (underbooking) opportunities.push(underbooking);

    const decline = detectActivityDecline(
      purchaseOrders.map((p) => p.created_at),
      "Commandes fournisseurs",
    );
    if (decline) opportunities.push(decline);
    return;
  }

  // Générique (aucune verticale dédiée) : seul le stock commun est pertinent.
  const inventory = await loadInventoryItems(supabase, workspaceId);
  const low = detectLowStock(inventory);
  if (low) opportunities.push(low);
}

/**
 * Marque une opportunité "fait"/"ignorée" — un snooze de 24h (voir
 * filterSnoozed dans lib/nova-opportunities.ts), pas une suppression
 * définitive : si le même type de signal réapparaît plus tard (ex. un
 * nouveau devis en retard), il redeviendra visible après la fenêtre.
 */
export async function setOpportunityStatus(
  workspaceId: string,
  opportunityKey: string,
  status: "done" | "dismissed",
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Vous n'êtes pas membre de ce workspace." };

  const { error } = await supabase
    .from("nova_action_log")
    .upsert(
      { workspace_id: workspaceId, opportunity_key: opportunityKey, status, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,opportunity_key" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/business-os");
  revalidatePath("/nova/actions");
  return { ok: true };
}
