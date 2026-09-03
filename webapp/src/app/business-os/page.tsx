import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";
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

  if (!businessOsAtLeast(plan, "standard")) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-lg font-extrabold">Business OS — plan Pro ou Max</h1>
          <p className="mt-2 text-[13px] text-muted">
            Le Business OS (clients, stock, rendez-vous adaptés à votre métier) est réservé aux plans Pro et Max.
            Votre workspace est actuellement sur le plan {plan}. Passez à Pro (Business OS standard) ou Max (Business
            OS avancé + NOVA métier) depuis{" "}
            <a href="/parametres" className="font-semibold text-accent">
              Paramètres → Abonnement
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

  const [{ data: customers }, { data: inventory }, { data: appointments }] = await Promise.all([
    supabase.from("customers").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("workspace_id", workspaceId).order("name"),
    supabase.from("appointments").select("*").eq("workspace_id", workspaceId).order("starts_at"),
  ]);

  const lowStock = (inventory ?? []).filter(
    (item) => item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold,
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              {profile.icon} {profile.osName}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              Modules réels adaptés à votre métier — mêmes tables, vocabulaire différent.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[10.5px] font-bold text-muted">
            {isAdvanced ? "Business OS avancé" : "Business OS standard"}
          </span>
        </div>

        {isAdvanced && lowStock.length > 0 && (
          <Card className="border-amber-bg bg-amber-bg">
            <h2 className="text-[13px] font-bold text-amber-fg">⚠ Alertes stock bas ({lowStock.length})</h2>
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-amber-fg">
              {lowStock.map((item) => (
                <li key={item.id}>
                  {item.name} — {item.quantity} {item.unit} restant(s) (seuil : {item.low_stock_threshold})
                </li>
              ))}
            </ul>
          </Card>
        )}

        <CustomersModule workspaceId={workspaceId} initial={customers ?? []} label={profile.customersLabel} />
        <InventoryModule workspaceId={workspaceId} initial={inventory ?? []} label={profile.inventoryLabel} />
        <AppointmentsModule workspaceId={workspaceId} initial={appointments ?? []} label={profile.appointmentsLabel} />

        {!isAdvanced && (
          <Card className="border-line bg-soft text-center">
            <p className="text-[12.5px] text-muted">
              Le plan Max ajoute les alertes de stock bas, NOVA connectée à ces données, et l&apos;équipe (jusqu&apos;à
              5 utilisateurs).{" "}
              <a href="/parametres" className="font-semibold text-accent">
                Voir le plan Max
              </a>
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
