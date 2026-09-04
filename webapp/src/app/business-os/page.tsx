import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";
import { getBusinessOsProfile } from "@/lib/business-os";
import { BusinessOsView } from "@/components/business-os/business-os-view";
import type { Contract, Project, RepairOrder, Vehicle, WasteLogEntry } from "@/lib/supabase/types";

export default async function BusinessOsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const membership = await getCachedMembership(user.id);
  if (!membership) redirect("/dashboard"); // workspace auto-provisionné dès l'inscription (0015) : ne devrait jamais arriver

  const workspaceId = membership.workspace_id;
  const plan = await getWorkspacePlan(workspaceId);

  if (!businessOsAtLeast(plan, "standard")) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-lg font-extrabold">Business OS — plan Pro ou Max</h1>
          <p className="mt-2 text-[13px] text-muted">
            Le Business OS (gestion adaptée à votre métier) est réservé aux plans Pro et Max. Votre workspace est
            actuellement sur le plan {plan}. Passez à Pro (Business OS standard) ou Max (Business OS avancé + NOVA
            métier) depuis{" "}
            <a href="/abonnement" className="font-semibold text-accent">
              Abonnements
            </a>
            .
          </p>
        </Card>
      </AppShell>
    );
  }

  const isAdvanced = businessOsAtLeast(plan, "advanced");

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("own_category_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  let parentSlug: string | null = null;
  let leafSlug: string | null = null;
  if (businessProfile?.own_category_id) {
    const { data: ownCategory } = await supabase
      .from("business_categories")
      .select("slug, parent_id")
      .eq("id", businessProfile.own_category_id)
      .maybeSingle();
    leafSlug = ownCategory?.slug ?? null;
    if (ownCategory?.parent_id) {
      const { data: parent } = await supabase
        .from("business_categories")
        .select("slug")
        .eq("id", ownCategory.parent_id)
        .maybeSingle();
      parentSlug = parent?.slug ?? null;
    }
  }

  const profile = getBusinessOsProfile(parentSlug, leafSlug);
  const vertical = profile.vertical;

  // On ne lit les tables spécifiques à un métier que pour ce métier — pas de
  // requête pour repair_orders sur un workspace "agence", par exemple.
  const [{ data: customers }, { data: inventory }, { data: appointments }, verticalData] = await Promise.all([
    supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("workspace_id", workspaceId).order("name"),
    supabase.from("appointments").select("*").eq("workspace_id", workspaceId).order("starts_at"),
    (async () => {
      if (vertical === "garage") {
        const [{ data: vehicles }, { data: repairOrders }] = await Promise.all([
          supabase.from("vehicles").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
          supabase
            .from("repair_orders")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false }),
        ]);
        return { vehicles: vehicles ?? [], repairOrders: repairOrders ?? [] };
      }
      if (vertical === "cleaning") {
        const { data: contracts } = await supabase
          .from("contracts")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        return { contracts: contracts ?? [] };
      }
      if (vertical === "agency") {
        const { data: projects } = await supabase
          .from("projects")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        return { projects: projects ?? [] };
      }
      if (vertical === "restaurant") {
        const { data: wasteLog } = await supabase
          .from("waste_log")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("logged_at", { ascending: false });
        return { wasteLog: wasteLog ?? [] };
      }
      return {};
    })(),
  ]);

  const vehicles: Vehicle[] = verticalData.vehicles ?? [];
  const repairOrders: RepairOrder[] = verticalData.repairOrders ?? [];
  const contracts: Contract[] = verticalData.contracts ?? [];
  const projects: Project[] = verticalData.projects ?? [];
  const wasteLog: WasteLogEntry[] = verticalData.wasteLog ?? [];

  const lowStock = (inventory ?? []).filter(
    (item) => item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold,
  );

  const now = new Date().getTime();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const upcomingAppointments = (appointments ?? []).filter((a) => new Date(a.starts_at).getTime() >= now);

  let kpis: { label: string; value: string; sub?: string }[] = [];
  let untrackedNote: string | undefined;
  let history: { id: string; label: string; date: string }[] = [];

  if (vertical === "garage") {
    const activeOrders = repairOrders.filter((r) => r.status !== "done" && r.status !== "invoiced");
    const vehiclesInShop = new Set(activeOrders.map((r) => r.vehicle_id).filter(Boolean)).size;
    const overdue = activeOrders.filter((r) => r.scheduled_at && new Date(r.scheduled_at).getTime() < now);
    const revenueThisMonth = repairOrders
      .filter((r) => r.completed_at && new Date(r.completed_at) >= monthStart && (r.status === "done" || r.status === "invoiced"))
      .reduce((sum, r) => sum + r.labor_cost + r.parts_cost, 0);
    kpis = [
      { label: "Véhicules en atelier", value: String(vehiclesInShop) },
      { label: "Réparations en retard", value: String(overdue.length) },
      { label: "Ordres actifs", value: String(activeOrders.length) },
      { label: "CA réparations (mois)", value: `${revenueThisMonth.toFixed(0)} €` },
      { label: "Pièces en stock faible", value: String(lowStock.length) },
      {
        label: "Prochain rendez-vous",
        value: upcomingAppointments[0] ? new Date(upcomingAppointments[0].starts_at).toLocaleDateString("fr-FR") : "—",
      },
    ];
    untrackedNote = "planning atelier visuel, devis/factures distincts, fiches techniciens";
    history = repairOrders
      .filter((r) => r.status === "done" || r.status === "invoiced")
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        label: r.title,
        date: r.completed_at ? new Date(r.completed_at).toLocaleDateString("fr-FR") : "—",
      }));
  } else if (vertical === "cleaning") {
    const activeContracts = contracts.filter((c) => c.status === "active");
    const renewals = contracts.filter((c) => c.status === "ending_soon");
    kpis = [
      { label: "Sites sous contrat", value: String(activeContracts.length) },
      { label: "Contrats à renouveler", value: String(renewals.length) },
      { label: "Interventions à venir", value: String(upcomingAppointments.length) },
      { label: "Consommables en stock faible", value: String(lowStock.length) },
    ];
    untrackedNote = "employés disponibles, incidents ouverts, suivi qualité";
    history = contracts
      .filter((c) => c.status === "ended")
      .slice(0, 20)
      .map((c) => ({ id: c.id, label: c.site_name, date: new Date(c.updated_at).toLocaleDateString("fr-FR") }));
  } else if (vertical === "agency") {
    const inProgress = projects.filter((p) => p.status === "in_progress");
    const inMaintenance = projects.filter((p) => p.status === "maintenance");
    const activeClients = new Set(projects.map((p) => p.customer_id).filter(Boolean)).size;
    kpis = [
      { label: "Projets en cours", value: String(inProgress.length) },
      { label: "En maintenance", value: String(inMaintenance.length) },
      { label: "Clients actifs", value: String(activeClients) },
      { label: "Échéances à venir", value: String(upcomingAppointments.length) },
    ];
    untrackedNote = "domaines/hébergements, tickets support, revenus récurrents facturés";
    history = projects
      .filter((p) => p.status === "done")
      .slice(0, 20)
      .map((p) => ({ id: p.id, label: p.name, date: new Date(p.updated_at).toLocaleDateString("fr-FR") }));
  } else if (vertical === "restaurant") {
    const wasteThisWeek = wasteLog
      .filter((w) => new Date(w.logged_at).getTime() >= weekAgo)
      .reduce((sum, w) => sum + (w.estimated_cost ?? 0), 0);
    kpis = [
      { label: "Ingrédients en stock critique", value: String(lowStock.length) },
      { label: "Pertes cette semaine", value: `${wasteThisWeek.toFixed(2)} €` },
      { label: "Réservations à venir", value: String(upcomingAppointments.length) },
    ];
    untrackedNote = "commandes fournisseurs, coût matière détaillé par recette";
  } else {
    kpis = [
      { label: profile.customersLabel, value: String((customers ?? []).length) },
      { label: profile.inventoryLabel, value: String((inventory ?? []).length) },
      { label: "Prochain rendez-vous", value: upcomingAppointments[0] ? new Date(upcomingAppointments[0].starts_at).toLocaleDateString("fr-FR") : "—" },
    ];
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              {profile.icon} {profile.osName}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              Modules réels adaptés à votre métier — données réelles de votre workspace, jamais de chiffre inventé.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[10.5px] font-bold text-muted">
            {isAdvanced ? "Business OS avancé" : "Business OS standard"}
          </span>
        </div>

        <BusinessOsView
          vertical={vertical}
          profile={profile}
          isAdvanced={isAdvanced}
          workspaceId={workspaceId}
          kpis={kpis}
          untrackedNote={untrackedNote}
          history={history}
          customers={customers ?? []}
          inventory={inventory ?? []}
          appointments={appointments ?? []}
          vehicles={vehicles}
          repairOrders={repairOrders}
          contracts={contracts}
          projects={projects}
          wasteLog={wasteLog}
          lowStock={lowStock}
        />
      </div>
    </AppShell>
  );
}
