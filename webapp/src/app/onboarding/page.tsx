import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categories, error } = await supabase
    .from("business_categories")
    .select("*")
    .order("sort_order");

  if (error || !categories) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-[13px] text-red-fg">
          Impossible de charger le catalogue de métiers : {error?.message}. Vérifiez que les
          migrations Supabase ont bien été appliquées (voir README).
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1">
      <OnboardingWizard categories={categories} />
    </main>
  );
}
