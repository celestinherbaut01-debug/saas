import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getWorkspacePlan, planAtLeast } from "@/lib/plan";
import { getBusinessOsProfile } from "@/lib/business-os";
import { CustomersModule } from "@/components/business-os/customers-module";
import { InventoryModule } from "@/components/business-os/inventory-module";
import { AppointmentsModule } from "@/components/business-os/appointments-module";

export default async function BusinessOsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const workspaceId = membership.workspace_id;
  const plan = await getWorkspacePlan(workspaceId);

  if (!planAtLeast(plan, "max")) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-lg font-extrabold">Business OS — plan Max</h1>
          <p className="mt-2 text-[13px] text-muted">
            Le Business OS (clients, stock, rendez-vous adaptés à votre métier) est réservé au plan Max. Votre
            workspace est actuellement sur le plan {plan}. Passez au plan Max depuis{" "}
            <a href="/parametres" className="font-semibold text-accent">
              Paramètres → Abonnement
            </a>
            .
          </p>
        </Card>
      </AppShell>
    );
  }

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("own_category_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  let parentSlug: string | null = null;
  if (businessProfile?.own_category_id) {
    const { data: ownCategory } = await supabase
      .from("business_categories")
      .select("parent_id")
      .eq("id", businessProfile.own_category_id)
      .maybeSingle();
    if (ownCategory?.parent_id) {
      const { data: parent } = await supabase
        .from("business_categories")
        .select("slug")
        .eq("id", ownCategory.parent_id)
        .maybeSingle();
      parentSlug = parent?.slug ?? null;
    }
  }

  const profile = getBusinessOsProfile(parentSlug);

  const [{ data: customers }, { data: inventory }, { data: appointments }] = await Promise.all([
    supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("workspace_id", workspaceId).order("name"),
    supabase.from("appointments").select("*").eq("workspace_id", workspaceId).order("starts_at"),
  ]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {profile.icon} {profile.osName}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Modules réels adaptés à votre métier — mêmes tables, vocabulaire différent.
          </p>
        </div>

        <CustomersModule workspaceId={workspaceId} initial={customers ?? []} label={profile.customersLabel} />
        <InventoryModule workspaceId={workspaceId} initial={inventory ?? []} label={profile.inventoryLabel} />
        <AppointmentsModule workspaceId={workspaceId} initial={appointments ?? []} label={profile.appointmentsLabel} />
      </div>
    </AppShell>
  );
}
