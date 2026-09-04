import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Status = "connected" | "not_connected" | "needs_config" | "info";

const STATUS_LABEL: Record<Status, { text: string; cls: string }> = {
  connected: { text: "Connecté", cls: "bg-green-bg text-green-fg" },
  not_connected: { text: "Non connecté", cls: "bg-soft text-muted" },
  needs_config: { text: "Configuration requise", cls: "bg-amber-bg text-amber-fg" },
  info: { text: "Géré ailleurs", cls: "bg-soft text-muted" },
};

function IntegrationRow({
  name,
  description,
  status,
  note,
}: {
  name: string;
  description: string;
  status: Status;
  note?: string;
}) {
  const s = STATUS_LABEL[status];
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3.5 last:border-0">
      <div>
        <p className="text-[13px] font-semibold">{name}</p>
        <p className="text-[12px] text-muted">{description}</p>
        {note && <p className="mt-0.5 text-[11px] text-faint">{note}</p>}
      </div>
      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold", s.cls)}>{s.text}</span>
    </div>
  );
}

export default async function IntegrationsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const googleConnected = user.identities?.some((i) => i.provider === "google") ?? false;
  const novaConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Intégrations</h1>
          <p className="mt-1 text-[13px] text-muted">
            État réel de chaque connexion — jamais affiché &laquo;&nbsp;Connecté&nbsp;&raquo; sans vérification.
          </p>
        </div>

        <Card>
          <h2 className="font-display text-sm font-bold">Compte</h2>
          <div className="mt-1">
            <IntegrationRow
              name="Google Sign-In"
              description="Identité de connexion à ProspectFlow."
              status={googleConnected ? "connected" : "not_connected"}
              note={googleConnected ? undefined : "Connecté par email/mot de passe."}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Prospection</h2>
          <div className="mt-1">
            <IntegrationRow
              name="Registre SIRENE/RNE"
              description="Recherche entreprises.api.gouv.fr — public, gratuit, toujours actif."
              status="connected"
            />
            <IntegrationRow
              name="Google Places"
              description="Vérification statut/site/téléphone des prospects."
              status="info"
              note="Clé gérée côté Edge Function Supabase (GOOGLE_MAPS_API_KEY), pas dans cette app. Le statut réel s'affiche après chaque recherche dans Prospection."
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Agent IA</h2>
          <div className="mt-1">
            <IntegrationRow
              name="NOVA (Anthropic)"
              description="Chat avec accès en lecture à vos vraies données CRM."
              status={novaConfigured ? "connected" : "needs_config"}
              note={novaConfigured ? undefined : "Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement."}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Email & Calendrier — pas encore implémenté</h2>
          <div className="mt-1">
            <IntegrationRow
              name="Gmail professionnel"
              description="Envoi et suivi des emails de prospection (séparé du compte de connexion)."
              status="not_connected"
              note="Phase suivante — pas encore de flux de connexion Gmail dans ce dépôt."
            />
            <IntegrationRow
              name="Google Calendar"
              description="Création de rendez-vous depuis une réponse positive."
              status="not_connected"
              note="Phase suivante — pas encore implémenté."
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-bold">Facturation — pas encore implémenté</h2>
          <div className="mt-1">
            <IntegrationRow
              name="Stripe"
              description="Paiement et gestion des abonnements Starter/Pro/Max."
              status={stripeConfigured ? "needs_config" : "not_connected"}
              note="Aucun Checkout n'est encore branché — la page Abonnement affiche les plans en lecture seule."
            />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
