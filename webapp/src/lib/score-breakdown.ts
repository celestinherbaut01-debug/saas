// Reflète exactement supabase/functions/_shared/scoring.ts — même clés, mêmes
// points, pour que "Pourquoi ce score ?" corresponde au vrai calcul et pas à
// une explication approximative.

const SOURCE_LABELS: Record<string, { label: string; points: number }> = {
  google_operational: {
    label: "Statut Google confirmé opérationnel",
    points: 15,
  },
  google_closed: { label: "Fermé définitivement (Google)", points: -40 },
  google_temp_closed: { label: "Fermé temporairement (Google)", points: -15 },
  no_website: { label: "Sans site renseigné sur Google", points: 20 },
  weak_website: { label: "Site existant mais faible", points: 12 },
  website_unverified: { label: "Site non vérifiable", points: 4 },
  independent_confirmed: {
    label: "Indépendant (registre officiel)",
    points: 10,
  },
  chain_detected: { label: "Chaîne/franchise détectée", points: -25 },
  association_or_public: {
    label: "Association ou secteur public",
    points: -20,
  },
  large_group: { label: "Gros groupe (≥ 250 salariés)", points: -20 },
  phone_verified: { label: "Téléphone vérifié disponible", points: 8 },
  large_structure_opportunity: {
    label: "Structure de taille significative",
    points: 15,
  },
  multi_site_opportunity: {
    label: "Signal d’enseigne (organisation à qualifier)",
    points: 8,
  },
  google_reviews_signal: { label: "Avis Google disponibles", points: 5 },
};

export interface ScoreBreakdownRow {
  label: string;
  points: number;
}

export function scoreBreakdown(
  sources: Record<string, boolean>,
  distanceKm: number | null,
): ScoreBreakdownRow[] {
  const rows: ScoreBreakdownRow[] = [{ label: "Base", points: 40 }];

  for (const [key, active] of Object.entries(sources)) {
    if (!active || key === "cached") continue;
    const entry = SOURCE_LABELS[key];
    if (!entry) continue;
    let points = entry.points;
    const contract =
      sources.profile_contract_potential || sources.profile_b2b_commercial;
    if (key === "association_or_public" && contract) points = -10;
    if (key === "no_website" || key === "weak_website") {
      const weight = sources.profile_digital_opportunity
        ? 1.4
        : sources.profile_marketing_potential
          ? 1.1
          : 1;
      points = Math.round(points * weight);
    }
    if (key === "website_unverified" && sources.scoring_v2) points = 0;
    if (key === "google_reviews_signal" && sources.google_reviews_many)
      points = 10;
    rows.push({ ...entry, points });
  }

  if (distanceKm != null) {
    if (distanceKm <= 5) rows.push({ label: "Distance ≤ 5 km", points: 5 });
    else if (distanceKm <= 15)
      rows.push({ label: "Distance ≤ 15 km", points: 2 });
  }

  return rows;
}
