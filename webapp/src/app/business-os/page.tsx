import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser, getCachedMembership } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";
import { getBusinessOsProfile } from "@/lib/business-os";
import { BusinessOsView } from "@/components/business-os/business-os-view";
import { GarageView } from "@/components/business-os/garage/garage-view";
import { CleaningView } from "@/components/business-os/cleaning/cleaning-view";
import { AgencyView } from "@/components/business-os/agency/agency-view";
import { RestaurantView } from "@/components/business-os/restaurant/restaurant-view";

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

  const header = (
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
  );

  // Garage a sa propre vue dédiée (bien plus riche que les 3 modules
  // génériques) : toutes les tables garage sont chargées ici en une seule
  // fois et confiées à GarageView, seul propriétaire de cet état côté client.
  if (vertical === "garage") {
    const [
      { data: customers },
      { data: vehicles },
      { data: technicians },
      { data: suppliers },
      { data: parts },
      { data: repairOrders },
      { data: lines },
      { data: documents },
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("vehicles").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("team_members").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("suppliers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("parts").select("*").eq("workspace_id", workspaceId).order("name"),
      supabase.from("repair_orders").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("repair_order_parts").select("*").eq("workspace_id", workspaceId),
      supabase.from("documents").select("*").eq("workspace_id", workspaceId).order("issued_at", { ascending: false }),
    ]);

    return (
      <AppShell>
        <div className="flex flex-col gap-5">
          {header}
          <GarageView
            workspaceId={workspaceId}
            isAdvanced={isAdvanced}
            initialCustomers={customers ?? []}
            initialVehicles={vehicles ?? []}
            initialTechnicians={technicians ?? []}
            initialSuppliers={suppliers ?? []}
            initialParts={parts ?? []}
            initialRepairOrders={repairOrders ?? []}
            initialLines={lines ?? []}
            initialDocuments={documents ?? []}
          />
        </div>
      </AppShell>
    );
  }

  // Nettoyage a aussi sa propre vue dédiée (mêmes principes que Garage).
  if (vertical === "cleaning") {
    const [
      { data: customers },
      { data: sites },
      { data: contracts },
      { data: interventions },
      { data: incidents },
      { data: teamMembers },
      { data: inventory },
      { data: documents },
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("sites").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("interventions").select("*").eq("workspace_id", workspaceId).order("scheduled_at", { ascending: false }),
      supabase.from("incidents").select("*").eq("workspace_id", workspaceId).order("reported_at", { ascending: false }),
      supabase.from("team_members").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("inventory_items").select("*").eq("workspace_id", workspaceId).order("name"),
      supabase.from("documents").select("*").eq("workspace_id", workspaceId).order("issued_at", { ascending: false }),
    ]);

    return (
      <AppShell>
        <div className="flex flex-col gap-5">
          {header}
          <CleaningView
            workspaceId={workspaceId}
            isAdvanced={isAdvanced}
            initialCustomers={customers ?? []}
            initialSites={sites ?? []}
            initialContracts={contracts ?? []}
            initialInterventions={interventions ?? []}
            initialIncidents={incidents ?? []}
            initialTeamMembers={teamMembers ?? []}
            initialInventory={inventory ?? []}
            initialDocuments={documents ?? []}
          />
        </div>
      </AppShell>
    );
  }

  // Agence a aussi sa propre vue dédiée (mêmes principes que Garage/Nettoyage).
  if (vertical === "agency") {
    const [
      { data: customers },
      { data: projects },
      { data: sites },
      { data: tickets },
      { data: tasks },
      { data: teamMembers },
      { data: documents },
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("projects").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("client_sites").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("tickets").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("due_date"),
      supabase.from("team_members").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("workspace_id", workspaceId).order("issued_at", { ascending: false }),
    ]);

    return (
      <AppShell>
        <div className="flex flex-col gap-5">
          {header}
          <AgencyView
            workspaceId={workspaceId}
            isAdvanced={isAdvanced}
            initialCustomers={customers ?? []}
            initialProjects={projects ?? []}
            initialSites={sites ?? []}
            initialTickets={tickets ?? []}
            initialTasks={tasks ?? []}
            initialTeamMembers={teamMembers ?? []}
            initialDocuments={documents ?? []}
          />
        </div>
      </AppShell>
    );
  }

  // Restaurant a aussi sa propre vue dédiée (mêmes principes que les autres).
  if (vertical === "restaurant") {
    const [
      { data: customers },
      { data: inventory },
      { data: suppliers },
      { data: purchaseOrders },
      { data: purchaseOrderItems },
      { data: recipes },
      { data: recipeIngredients },
      { data: wasteLog },
      { data: appointments },
      { data: teamMembers },
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("inventory_items").select("*").eq("workspace_id", workspaceId).order("name"),
      supabase.from("suppliers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("purchase_order_items").select("*").eq("workspace_id", workspaceId),
      supabase.from("recipes").select("*").eq("workspace_id", workspaceId).order("name"),
      supabase.from("recipe_ingredients").select("*").eq("workspace_id", workspaceId),
      supabase.from("waste_log").select("*").eq("workspace_id", workspaceId).order("logged_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("workspace_id", workspaceId).order("starts_at"),
      supabase.from("team_members").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    ]);

    return (
      <AppShell>
        <div className="flex flex-col gap-5">
          {header}
          <RestaurantView
            workspaceId={workspaceId}
            isAdvanced={isAdvanced}
            initialCustomers={customers ?? []}
            initialInventory={inventory ?? []}
            initialSuppliers={suppliers ?? []}
            initialPurchaseOrders={purchaseOrders ?? []}
            initialPurchaseOrderItems={purchaseOrderItems ?? []}
            initialRecipes={recipes ?? []}
            initialRecipeIngredients={recipeIngredients ?? []}
            initialWasteLog={wasteLog ?? []}
            initialAppointments={appointments ?? []}
            initialTeamMembers={teamMembers ?? []}
          />
        </div>
      </AppShell>
    );
  }

  // Métier générique (aucune verticale dédiée) : les 3 modules communs.
  const [{ data: customers }, { data: inventory }, { data: appointments }] = await Promise.all([
    supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("workspace_id", workspaceId).order("name"),
    supabase.from("appointments").select("*").eq("workspace_id", workspaceId).order("starts_at"),
  ]);

  const lowStock = (inventory ?? []).filter(
    (item) => item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold,
  );

  const upcomingAppointments = (appointments ?? []).filter((a) => new Date(a.starts_at).getTime() >= new Date().getTime());

  const kpis = [
    { label: profile.customersLabel, value: String((customers ?? []).length) },
    { label: profile.inventoryLabel, value: String((inventory ?? []).length) },
    { label: "Prochain rendez-vous", value: upcomingAppointments[0] ? new Date(upcomingAppointments[0].starts_at).toLocaleDateString("fr-FR") : "—" },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {header}

        <BusinessOsView
          profile={profile}
          isAdvanced={isAdvanced}
          workspaceId={workspaceId}
          kpis={kpis}
          history={[]}
          customers={customers ?? []}
          inventory={inventory ?? []}
          appointments={appointments ?? []}
          lowStock={lowStock}
        />
      </div>
    </AppShell>
  );
}
