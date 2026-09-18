import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

// Couche UNIQUE de lecture des tables Business OS partagées — NOVA
// (lib/actions/nova.ts), NOVA Growth Autopilot (lib/actions/nova-
// opportunities.ts) et Business Twin (lib/business-twin/*) doivent tous
// passer par ces fonctions plutôt que d'écrire chacun leur propre
// `.from(...).select(...)`. Avant cette couche, les trois moteurs
// interrogeaient indépendamment les mêmes tables avec des filtres/sélections
// de colonnes parfois différents — un risque réel de divergence silencieuse
// (ex. un moteur compte un client "archivé" et un autre non).
//
// Chaque fonction renvoie la ligne COMPLÈTE (types générés depuis le schéma
// réel) plutôt qu'une sélection de colonnes : la mise en forme propre à un
// consommateur (ex. NOVA qui ne garde que 5 champs pour une réponse d'outil)
// se fait APRÈS coup sur ce même résultat, jamais via une requête distincte
// qui pourrait diverger. Le filtre `archived_at is null` est appliqué ici
// une seule fois, pour toutes les tables qui ont cette colonne — plus un
// seul endroit où ce détail peut être oublié.

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export async function loadCustomers(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"customers">[]> {
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Devis/factures — partagé garage/nettoyage/agence (pas de table `documents` en restaurant, voir purchase_orders). */
export async function loadDocuments(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"documents">[]> {
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("issued_at", { ascending: false });
  return data ?? [];
}

export async function loadInventoryItems(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"inventory_items">[]> {
  const { data } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("name");
  return data ?? [];
}

/** Stock garage — table distincte d'inventory_items (voir 0019_garage_business_os.sql). */
export async function loadParts(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"parts">[]> {
  const { data } = await supabase.from("parts").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("name");
  return data ?? [];
}

export async function loadRepairOrders(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"repair_orders">[]> {
  const { data } = await supabase
    .from("repair_orders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function loadInterventions(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"interventions">[]> {
  const { data } = await supabase
    .from("interventions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: false });
  return data ?? [];
}

export async function loadContracts(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"contracts">[]> {
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function loadClientSites(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"client_sites">[]> {
  const { data } = await supabase
    .from("client_sites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function loadPurchaseOrders(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"purchase_orders">[]> {
  const { data } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function loadAppointments(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"appointments">[]> {
  const { data } = await supabase.from("appointments").select("*").eq("workspace_id", workspaceId).order("starts_at");
  return data ?? [];
}

export async function loadProspects(supabase: SupabaseServerClient, workspaceId: string): Promise<Row<"prospects">[]> {
  const { data } = await supabase.from("prospects").select("*").eq("workspace_id", workspaceId);
  return data ?? [];
}
