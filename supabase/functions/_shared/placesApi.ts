export interface PlacesVerification {
  placeId: string | null;
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "unverified";
  websiteUri: string | null;
  phone: string | null;
  rating: number | null;
  ratingCount: number | null;
}

const UNVERIFIED: PlacesVerification = {
  placeId: null,
  businessStatus: "unverified",
  websiteUri: null,
  phone: null,
  rating: null,
  ratingCount: null,
};

/**
 * Vérifie un établissement via Google Places API (New) :
 * 1. Text Search pour retrouver le lieu à partir du nom + adresse.
 * 2. Place Details pour récupérer businessStatus / site / téléphone / avis.
 *
 * Coûte une requête Text Search + une requête Place Details par établissement
 * (facturées par Google) — c'est pourquoi l'appelant plafonne le nombre
 * d'établissements envoyés ici et met les résultats en cache par SIRET.
 */
export async function verifyWithGooglePlaces(
  companyName: string,
  address: string,
  apiKey: string,
): Promise<PlacesVerification> {
  try {
    const searchRes = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          textQuery: `${companyName}, ${address}`,
          languageCode: "fr",
          regionCode: "FR",
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!searchRes.ok) return UNVERIFIED;
    const searchData = await searchRes.json();
    const placeId: string | undefined = searchData?.places?.[0]?.id;
    if (!placeId) return UNVERIFIED;

    const detailsRes = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "id,businessStatus,websiteUri,nationalPhoneNumber,rating,userRatingCount",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!detailsRes.ok) {
      return { ...UNVERIFIED, placeId };
    }
    const details = await detailsRes.json();

    return {
      placeId,
      businessStatus: details.businessStatus ?? "unverified",
      websiteUri: details.websiteUri ?? null,
      phone: details.nationalPhoneNumber ?? null,
      rating: typeof details.rating === "number" ? details.rating : null,
      ratingCount:
        typeof details.userRatingCount === "number" ? details.userRatingCount : null,
    };
  } catch {
    // Timeout, erreur réseau, quota dépassé... on ne bloque jamais la recherche
    // pour un établissement : il repart en "à vérifier".
    return UNVERIFIED;
  }
}
