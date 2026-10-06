import { DataLoadError, classifyDataError } from "@/lib/data-state";
import { DataLoadErrorView } from "@/components/data-load-error";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

async function OnboardingPageContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categories } = await supabase
    .from("business_categories")
    .select("*")
    .order("sort_order").throwOnError();

  if (!categories) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-[13px] text-red-fg">
          Impossible de charger le catalogue de métiers : . Vérifiez que les
          migrations Supabase ont bien été appliquées (voir README).
        </p>
      </main>
    );
  }

  return (
    <main className="pf-app flex flex-1">
      <OnboardingWizard categories={categories} />
    </main>
  );
}

export default async function OnboardingPage() { try { return await OnboardingPageContent(); } catch(error) { if(error instanceof DataLoadError) return <DataLoadErrorView kind={error.kind}/>; if(error && typeof error === "object" && "code" in error) return <DataLoadErrorView kind={classifyDataError(error)}/>; throw error; } }
