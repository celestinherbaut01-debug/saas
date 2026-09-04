/** Construit une vraie URL Google Maps vers la fiche du prospect (jamais un lien inventé). */
export function googleMapsUrl(params: { placeId?: string | null; companyName: string; address: string }) {
  if (params.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(params.placeId)}`;
  }
  // Pas de place_id (établissement non vérifié via Places) : recherche par nom + adresse,
  // toujours réel, jamais une fiche inventée.
  const query = [params.companyName, params.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * Recherche Google classique (pas Maps) sur nom + ville — le repli manuel
 * quand Google Places n'est pas configuré ou n'a pas confirmé
 * l'établissement : permet à l'utilisateur de vérifier lui-même site,
 * fiche Google, téléphone, présence digitale.
 */
export function googleSearchUrl(companyName: string, city: string | null) {
  const query = [companyName, city].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
