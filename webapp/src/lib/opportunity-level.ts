/** Traduction qualitative du score numérique — jamais un second calcul, juste un libellé sur le même chiffre. */
export function opportunityLevel(score: number): { text: string; cls: string } {
  if (score >= 75) return { text: "Élevé", cls: "bg-green-bg text-green-fg" };
  if (score >= 50) return { text: "Moyen", cls: "bg-amber-bg text-amber-fg" };
  return { text: "Faible", cls: "bg-soft text-muted" };
}
