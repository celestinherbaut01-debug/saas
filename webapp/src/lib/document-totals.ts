// Calcul HT/TVA/TTC d'un devis/facture à partir de ses lignes — fonction
// PURE, seule source de vérité pour ce calcul (jamais recalculé autrement
// ailleurs dans le produit, jamais une donnée inventée : un total vient
// toujours de la somme réelle des lignes).

export interface DocumentLineInput {
  description: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
}

export interface DocumentTotals {
  totalHt: number;
  totalVat: number;
  totalTtc: number;
}

/** Arrondi à 2 décimales — jamais de flottant brut affiché/stocké (0.1+0.2 etc.). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotalHt(line: DocumentLineInput): number {
  return round2(line.quantity * line.unitPriceHt);
}

export function lineTotalTtc(line: DocumentLineInput): number {
  const ht = line.quantity * line.unitPriceHt;
  return round2(ht * (1 + line.vatRate / 100));
}

export function computeDocumentTotals(lines: DocumentLineInput[]): DocumentTotals {
  const totalHt = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPriceHt, 0));
  const totalTtc = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPriceHt * (1 + l.vatRate / 100), 0));
  return { totalHt, totalVat: round2(totalTtc - totalHt), totalTtc };
}

/**
 * Numéro de document auto-généré — même format que celui déjà utilisé par
 * createInvoiceFromProject (agency-view.tsx) avant cette fonctionnalité,
 * généralisé aux devis : "FAC-2026-0001" / "DEV-2026-0001", compteur basé
 * sur les documents RÉELLEMENT déjà existants du même type pour l'année en
 * cours — jamais un numéro fabriqué hors contexte.
 */
export function nextDocumentNumber(docType: "quote" | "invoice", existingNumbersThisYear: number): string {
  const prefix = docType === "invoice" ? "FAC" : "DEV";
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(existingNumbersThisYear + 1).padStart(4, "0")}`;
}
