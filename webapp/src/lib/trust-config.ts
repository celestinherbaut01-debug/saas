// Configuration de la couche de réassurance (tarifs/abonnement/landing) —
// jamais une promesse affichée avant d'être réellement vraie. Même
// discipline que pour les plans (lib/entitlements.ts) : une seule source de
// vérité, jamais un texte codé en dur qu'on oublierait de mettre à jour
// quand l'état réel change.

/** Vrai uniquement quand Stripe est réellement configuré côté serveur — jamais affiché "Paiement sécurisé par Stripe" avant. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Garantie "satisfait ou remboursé" — désactivée tant que la décision
 * produit officielle n'est pas prise. Passer cette valeur à `true` l'affiche
 * partout où c'est pertinent ; tant qu'elle reste `false`, aucune page ne
 * doit la présenter comme une promesse réelle.
 */
export const ENABLE_MONEY_BACK_GUARANTEE = false;

/** Nombre de jours affiché quand la garantie est active — jamais recopié en dur ailleurs. */
export const MONEY_BACK_GUARANTEE_DAYS = 14;
