import { cn } from "@/lib/utils";
import type { GeneratedContent } from "@/lib/studio/types";

export type ChannelKey = "instagram" | "facebook" | "email" | "site" | "sms";

/**
 * Aperçu réaliste par canal — jamais du texte brut dans un <pre> présenté
 * comme "preview". Utilise la vraie photo principale quand elle existe,
 * un espace réservé sobre sinon (jamais une image générée/inventée à sa
 * place).
 */
export function ChannelPreview({
  channel,
  content,
  companyName,
  photoUrl,
}: {
  channel: ChannelKey;
  content: GeneratedContent;
  companyName: string;
  photoUrl: string | null;
}) {
  const initial = companyName.slice(0, 1).toUpperCase();

  if (channel === "instagram") {
    return (
      <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-[11px] font-bold text-white">
            {initial}
          </span>
          <p className="text-[12px] font-semibold">{companyName}</p>
        </div>
        <PhotoArea photoUrl={photoUrl} />
        <div className="flex items-center gap-3 px-3 pt-2.5 text-[16px] text-ink/70">
          <span>♡</span>
          <span>💬</span>
          <span>↗</span>
        </div>
        <p className="whitespace-pre-wrap px-3 py-2.5 text-[12px] leading-relaxed text-ink">
          <span className="font-semibold">{companyName}</span> {content.instagram}
        </p>
      </div>
    );
  }

  if (channel === "facebook") {
    return (
      <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-[12px] font-bold text-white">
            {initial}
          </span>
          <div>
            <p className="text-[12.5px] font-semibold">{companyName}</p>
            <p className="text-[10px] text-faint">Publication sponsorisée</p>
          </div>
        </div>
        <p className="whitespace-pre-wrap px-3.5 pb-3 text-[12.5px] leading-relaxed text-ink">{content.facebook}</p>
        <PhotoArea photoUrl={photoUrl} />
      </div>
    );
  }

  if (channel === "email") {
    return (
      <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-sm)]">
        <div className="border-b border-line bg-soft px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-faint">Objet</p>
          <p className="text-[13px] font-semibold text-ink">{content.email.subject}</p>
        </div>
        <p className="whitespace-pre-wrap px-4 py-3.5 text-[12.5px] leading-relaxed text-ink">{content.email.body}</p>
      </div>
    );
  }

  if (channel === "sms") {
    return (
      <div className="mx-auto flex w-full max-w-[280px] flex-col items-end gap-1">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-[12.5px] leading-relaxed text-accent-ink shadow-[var(--shadow-sm)]">
          {content.sms}
        </div>
        <span className="text-[10px] text-faint">Envoyé</span>
      </div>
    );
  }

  // site
  return (
    <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow-sm)]">
      <PhotoArea photoUrl={photoUrl} tall />
      <div className="px-5 py-4">
        <h3 className="font-display text-[16px] font-extrabold text-ink">{content.site.headline}</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">{content.site.body}</p>
        <span className="mt-3 inline-block rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-bg">{content.site.cta}</span>
      </div>
    </div>
  );
}

function PhotoArea({ photoUrl, tall }: { photoUrl: string | null; tall?: boolean }) {
  return (
    <div className={cn("relative w-full bg-soft", tall ? "aspect-[16/9]" : "aspect-square")}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu d'une photo utilisateur en Storage
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-faint">
          <span className="text-2xl opacity-50">🖼️</span>
          <span className="text-[10.5px]">Aucune photo ajoutée</span>
        </div>
      )}
    </div>
  );
}
