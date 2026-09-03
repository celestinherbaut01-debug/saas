// "Rester connecté" — ce que Supabase permet réellement.
//
// Supabase (via @supabase/ssr) stocke la session dans des cookies HTTP,
// rafraîchis à chaque requête. Il n'y a pas d'option native "session
// courte vs longue" au niveau du client JS pour ce mode cookie (le flag
// `persistSession` ne s'applique qu'au stockage localStorage, pas ici).
//
// Ce qui EST réellement faisable et fiable : la différence entre un cookie
// "de session" (sans Max-Age/Expires — le navigateur le supprime à la
// fermeture complète du navigateur) et un cookie persistant (avec Max-Age —
// survit aux redémarrages). C'est exactement ce que fait cette fonction :
// si l'utilisateur décoche "Rester connecté", on retire Max-Age/Expires des
// cookies d'auth avant de les écrire.
//
// Limite honnête à connaître : certains navigateurs (Chrome "Continuer où
// vous en étiez", restauration de session au redémarrage) peuvent rouvrir
// les cookies de session malgré tout. C'est une limite du web, pas de cette
// implémentation — aucune solution ne l'évite complètement sans backend de
// session dédié.

export const REMEMBER_COOKIE = "pf-remember";

interface CookieToSet {
  name: string;
  value: string;
  options?: { maxAge?: number; expires?: Date | number; [key: string]: unknown };
}

export function applyRememberPreference<T extends CookieToSet>(cookiesToSet: T[], remember: boolean): T[] {
  if (remember) return cookiesToSet;
  return cookiesToSet.map((c) => {
    if (c.name === REMEMBER_COOKIE || !c.options) return c;
    const rest = { ...c.options };
    delete rest.maxAge;
    delete rest.expires;
    return { ...c, options: rest } as T;
  });
}
