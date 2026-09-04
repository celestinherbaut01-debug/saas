import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Primitives mémorisées par requête (React `cache()`) pour l'utilisateur
// connecté et son workspace. Avant ce fichier, chaque page ET AppShell
// appelaient chacun `supabase.auth.getUser()` (un aller-retour réseau réel
// — Supabase revérifie le JWT auprès du serveur Auth, ce n'est pas un
// simple décodage local) et la requête workspace_members, doublant ces deux
// appels sur CHAQUE navigation. `cache()` fait qu'un deuxième appel avec les
// mêmes arguments, dans la même requête, renvoie le résultat déjà obtenu au
// lieu de refaire l'aller-retour — sans rien changer au comportement.
export const getCachedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export interface Membership {
  workspace_id: string;
}

export const getCachedMembership = cache(async (userId: string): Promise<Membership | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data;
});
