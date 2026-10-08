"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessCategory } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { BusinessActivityCard } from "@/components/settings/business-activity-card";

/**
 * Permet de changer de métier directement depuis /business-os, sans passer
 * par /parametres — réutilise BusinessActivityCard/updateOwnCategory tels
 * quels (aucune nouvelle logique de sauvegarde). router.refresh() recharge
 * la page serveur juste après confirmation pour afficher immédiatement le
 * nouveau Business OS (ex. Garage OS -> Boucherie OS), sans rechargement
 * manuel du navigateur.
 */
export function MetierSwitcher({
  workspaceId,
  categories,
  ownCategoryId,
  ownCategoryLabel,
}: {
  workspaceId: string;
  categories: BusinessCategory[];
  ownCategoryId: string | null;
  ownCategoryLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Changer de métier
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Changer de métier" subtitle="Votre espace de gestion s'adapte au métier choisi. Vos données existantes ne sont jamais supprimées.">
        <BusinessActivityCard
          workspaceId={workspaceId}
          categories={categories}
          ownCategoryId={ownCategoryId}
          ownCategoryLabel={ownCategoryLabel}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Drawer>
    </>
  );
}
