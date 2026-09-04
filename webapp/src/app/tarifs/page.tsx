import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PricingTable } from "@/components/pricing-table";
import { PricingTrust } from "@/components/pricing-trust";
import { PricingBusinessOs } from "@/components/pricing-business-os";

export default async function TarifsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-6xl flex-col items-center gap-16 px-6 py-16 sm:py-20">
        <div className="flex max-w-xl flex-col items-center gap-4 text-center">
          <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-tight sm:text-[40px]">
            Un plan pour chaque étape de votre croissance.
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Commencez gratuitement. Passez à une offre supérieure lorsque vous avez besoin de plus de
            prospects, d&apos;automatisation et de gestion.
          </p>
        </div>

        <PricingTable loggedIn={Boolean(user)} />
        <PricingTrust />
        <PricingBusinessOs />
      </main>
    </div>
  );
}
