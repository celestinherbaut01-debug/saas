import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { ProspectDetail } from "@/components/crm/prospect-detail";

export default async function ProspectDetailPage({ params }: PageProps<"/crm/[id]">) {
  const { id } = await params;
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Les deux requêtes ne dépendent que de `id` (pas l'une de l'autre) :
  // parallélisées plutôt qu'attendues l'une après l'autre.
  const [{ data: prospect }, { data: activities }] = await Promise.all([
    supabase.from("prospects").select("*").eq("id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
  ]);
  if (!prospect) notFound();

  return (
    <AppShell>
      <ProspectDetail prospect={prospect} initialActivities={activities ?? []} />
    </AppShell>
  );
}
