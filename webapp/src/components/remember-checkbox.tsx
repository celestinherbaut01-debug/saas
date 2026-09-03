"use client";

import { useEffect, useState } from "react";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";

function writeCookie(remember: boolean) {
  // Persistant (1 an) si coché ; cookie de session (pas de max-age, supprimé
  // à la fermeture complète du navigateur) sinon. Lu ensuite côté serveur
  // par server.ts / proxy.ts pour décider comment écrire les cookies Supabase.
  document.cookie = remember
    ? `${REMEMBER_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
    : `${REMEMBER_COOKIE}=0; path=/; samesite=lax`;
}

/** Case à cocher "Rester connecté", partagée au-dessus des deux méthodes de connexion. */
export function RememberCheckbox() {
  const [remember, setRemember] = useState(true);

  // Valeur par défaut (persistant) écrite dès l'affichage de la page, pour
  // que même un clic immédiat sur "Continuer avec Google" soit couvert.
  useEffect(() => {
    writeCookie(true);
  }, []);

  return (
    <label className="flex items-center gap-2 text-[12.5px] text-muted">
      <input
        type="checkbox"
        checked={remember}
        onChange={(e) => {
          setRemember(e.target.checked);
          writeCookie(e.target.checked);
        }}
        className="h-3.5 w-3.5 rounded border-line"
      />
      Rester connecté sur cet appareil
    </label>
  );
}
