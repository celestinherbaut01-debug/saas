// Géocodage/autocomplétion d'adresses françaises via la Base Adresse
// Nationale (api-adresse.data.gouv.fr) : API publique, gratuite, sans clé.
// Utilisée côté client — contrairement à Google, aucune clé facturée n'est
// donc exposée dans le navigateur.

export interface AddressSuggestion {
  label: string;
  street: string;
  postalCode: string;
  city: string;
  lat: number;
  lng: number;
  score: number;
}

export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];

  const params = new URLSearchParams({ q: query, limit: "6" });
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`);
  if (!res.ok) return [];

  const data = await res.json();
  return (data.features ?? []).map((f: {
    properties: { label: string; postcode?: string; city?: string; name?: string; score: number };
    geometry: { coordinates: [number, number] };
  }) => ({
    label: f.properties.label,
    street: f.properties.name ?? "",
    postalCode: f.properties.postcode ?? "",
    city: f.properties.city ?? "",
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    score: f.properties.score,
  }));
}

/**
 * Erreur de géolocalisation qui conserve le code natif du navigateur
 * (1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT, 0 = pas
 * supporté) pour permettre d'afficher un message utilisateur propre plutôt
 * que le texte brut du navigateur (ex. "User denied Geolocation").
 */
export class GeolocationAppError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function geolocateBrowser(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationAppError(0, "Géolocalisation non supportée par ce navigateur."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new GeolocationAppError(err.code, err.message)),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

/** Reverse-géocodage : transforme des coordonnées GPS en adresse lisible. */
export async function reverseGeocode(lat: number, lng: number): Promise<AddressSuggestion | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
  const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) return null;
  return {
    label: f.properties.label,
    street: f.properties.name ?? "",
    postalCode: f.properties.postcode ?? "",
    city: f.properties.city ?? "",
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    score: f.properties.score ?? 1,
  };
}
