import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { ProspectDetail } from "@/components/crm/prospect-detail";

export default async function ProspectDetailPage({ params }: PageProps<"/crm/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle();
  if (!prospect) notFound();

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("prospect_id", id)
    .order("created_at", { ascending: false });

  return (
    <AppShell>
      <ProspectDetail prospect={prospect} initialActivities={activities ?? []} />
    </AppShell>
  );
}
