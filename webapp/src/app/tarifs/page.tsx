import { PublicNav } from "@/components/public-nav";
import { PricingTable } from "@/components/pricing-table";

export default function TarifsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Des tarifs simples, sans surprise</h1>
          <p className="max-w-md text-[14px] text-muted">
            Commencez gratuitement. Passez au forfait supérieur quand vous en avez besoin — jamais avant.
          </p>
        </div>
        <PricingTable />
      </main>
    </div>
  );
}
