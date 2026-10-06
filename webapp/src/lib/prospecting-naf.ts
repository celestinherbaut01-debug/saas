import type { BusinessCategory } from "@/lib/supabase/types";

/**
 * Codes NAF à envoyer au registre pour les catégories sélectionnées —
 * fonction PURE, extraite pour être testable isolément (voir
 * src/lib/__tests__/prospecting-naf.test.ts). Ne retient QUE les codes des
 * catégories explicitement sélectionnées : sélectionner "Boulangeries"
 * seule ne doit jamais ramener les codes de "Boucheries" (test bloquant
 * demandé — sélection d'un seul métier vs. plusieurs métiers).
 */
export function nafCodesForSelection(targetIds: string[], categories: Pick<BusinessCategory, "id" | "naf_codes">[]): string[] {
  const set = new Set<string>();
  for (const id of targetIds) {
    const cat = categories.find((c) => c.id === id);
    cat?.naf_codes.forEach((code) => set.add(code));
  }
  return [...set];
}
