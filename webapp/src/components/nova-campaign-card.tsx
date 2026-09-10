import { Card } from "@/components/ui/card";
import type { CampaignTemplate } from "@/lib/nova-campaign";

/**
 * Affiche un template de campagne généré par generateCampaignTemplate()
 * (lib/nova-campaign.ts) — du texte préparé (Facebook/Instagram/SMS/email)
 * prêt à copier-coller et adapter, jamais un envoi automatique : ProspectFlow
 * n'a aucune intégration Meta/Gmail/SMS branchée à ce stade (voir item 16 de
 * la refonte). L'offre reste TOUJOURS à préciser par l'utilisateur — jamais
 * un prix inventé.
 */
export function CampaignTemplateCard({ template }: { template: CampaignTemplate }) {
  return (
    <Card>
      <h2 className="text-[13px] font-bold text-ink">{template.headline}</h2>
      <p className="mt-1 text-[11.5px] font-medium text-amber-fg">{template.offerPrompt}</p>
      <p className="mt-2 text-[12px] text-muted">
        <span className="font-semibold text-ink">Cible : </span>
        {template.targetDescription}
      </p>

      <div className="mt-3 text-[11.5px] text-muted">
        {template.estimatedContacts.known ? (
          <span>
            <span className="font-semibold text-ink">{template.estimatedContacts.count}</span> client(s) potentiel(s)
            à contacter — {template.estimatedContacts.source}.
          </span>
        ) : (
          <span className="italic text-faint">{template.estimatedContacts.reason}</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TemplateBlock title="Publication Facebook" text={template.facebookText} />
        <TemplateBlock title="Publication Instagram" text={template.instagramText} />
        <TemplateBlock title="SMS" text={template.smsText} />
        <TemplateBlock title="Email" text={template.emailText} />
      </div>

      <p className="mt-3 text-[11px] text-muted">
        <span className="font-semibold text-ink">Idée de visuel : </span>
        {template.visualIdea}
      </p>

      <p className="mt-3 text-[10.5px] text-faint">
        Texte préparé à relire et adapter — aucun envoi automatique n&apos;est déclenché depuis cette page.
      </p>
    </Card>
  );
}

function TemplateBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg p-3">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-faint">{title}</p>
      <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink">{text}</pre>
    </div>
  );
}
