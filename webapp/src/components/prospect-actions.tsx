import { googleMapsUrl, telHref } from "@/lib/prospect-links";

/**
 * Liens de vérification manuelle — jamais fabriqués : "Voir le site" n'existe
 * que si websiteUri a été confirmé par Google Places, "Appeler" que si un
 * téléphone existe.
 */
export function ProspectActions({
  websiteUri,
  phone,
  placeId,
  companyName,
  address,
}: {
  websiteUri: string | null;
  phone: string | null;
  placeId: string | null;
  companyName: string;
  address: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {websiteUri && (
        <a
          href={websiteUri}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold text-ink hover:bg-soft"
        >
          Voir le site
        </a>
      )}
      <a
        href={googleMapsUrl({ placeId, companyName, address })}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold text-ink hover:bg-soft"
      >
        Vérifier sur Google
      </a>
      {phone && (
        <a
          href={telHref(phone)}
          className="rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold text-ink hover:bg-soft"
        >
          Appeler
        </a>
      )}
    </div>
  );
}
