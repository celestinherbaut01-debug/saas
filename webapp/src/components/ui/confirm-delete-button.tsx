"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Bouton "Supprimer" qui ne supprime jamais au premier clic — un clic ouvre
 * une confirmation en ligne ("Supprimer définitivement {itemLabel} ?" avec
 * Annuler/Supprimer), le deuxième clic exécute réellement l'action. Aucune
 * suppression destructive dans ce produit ne doit contourner ce composant.
 *
 * Quand `onArchive` est fourni, une option plus sûre ("Archiver") est
 * proposée à côté — l'élément disparaît des listes actives sans perdre les
 * données ni casser les enregistrements qui pointent encore vers lui.
 *
 * Quand `forceArchiveReason` est fourni, la suppression définitive est
 * masquée entièrement : seule l'archive reste possible, avec l'explication
 * affichée (utilisé quand supprimer casserait des données réellement liées,
 * ex. un devis/une facture qui disparaîtrait avec l'ordre de réparation).
 */
export function ConfirmDeleteButton({
  itemLabel,
  onConfirm,
  onArchive,
  forceArchiveReason,
  size = "default",
}: {
  itemLabel: string;
  onConfirm: () => void;
  onArchive?: () => void;
  forceArchiveReason?: string;
  size?: "default" | "sm";
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming && !forceArchiveReason) {
    return (
      <div className="flex flex-1 flex-col gap-2 rounded-lg border border-red-fg/30 bg-red-bg/40 p-3">
        <p className="text-[12.5px] font-semibold text-red-fg">Supprimer définitivement {itemLabel} ?</p>
        <p className="text-[11.5px] text-red-fg/80">Cette action est irréversible.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            onClick={() => {
              setConfirming(false);
              onConfirm();
            }}
          >
            Supprimer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="flex gap-2">
        {onArchive && (
          <Button variant="outline" size={size} className="flex-1" onClick={onArchive}>
            Archiver
          </Button>
        )}
        {!forceArchiveReason && (
          <Button variant="outline" size={size} className="flex-1" onClick={() => setConfirming(true)}>
            Supprimer
          </Button>
        )}
      </div>
      {forceArchiveReason && <p className="text-[11px] text-faint">{forceArchiveReason}</p>}
    </div>
  );
}
