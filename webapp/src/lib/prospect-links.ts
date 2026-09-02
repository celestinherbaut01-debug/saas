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
