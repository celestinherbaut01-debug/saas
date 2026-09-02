// Géocodage d'adresses françaises via la Base Adresse Nationale
// (api-adresse.data.gouv.fr) : API publique, gratuite, sans clé, sans
// limite d'usage raisonnable. On l'utilise côté client — contrairement à
// Google Places, aucune clé facturée n'est donc exposée dans le navigateur.

export async function geocodeAddress({ street, postalCode, city }) {
  const q = [street, postalCode, city].filter(Boolean).join(" ");
  if (!q.trim()) throw new Error("Adresse vide");

  const params = new URLSearchParams({ q, limit: "1" });
  if (postalCode) params.set("postcode", postalCode);

  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`);
  if (!res.ok) throw new Error("Service de géocodage indisponible");

  const data = await res.json();
  const best = data.features?.[0];
  if (!best) throw new Error("Adresse introuvable — vérifiez la saisie");

  const [lng, lat] = best.geometry.coordinates;
  return {
    lat,
    lng,
    label: best.properties.label,
    score: best.properties.score, // 0-1, confiance du géocodage
  };
}

export function geolocateBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Géolocalisation non supportée par ce navigateur"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
