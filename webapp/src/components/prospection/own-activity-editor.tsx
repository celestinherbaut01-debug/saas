"use client";

import { useState, useTransition } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { CategoryCombobox } from "@/components/onboarding/category-combobox";
import { Button } from "@/components/ui/button";
import { updateOwnCategory } from "@/lib/actions/settings";

/**
 * Modifiable EN PLACE depuis Prospection — jamais besoin de refaire
 * l'onboarding. Met à jour l'état local immédiatement (le parent recalcule
 * objectifs/cibles/signaux au rendu suivant, sans rechargement) puis
 * persiste en base ; un échec de sauvegarde ne revient jamais en arrière
 * silencieusement, il est signalé.
 */
export function OwnActivityEditor({
  workspaceId,
  categories,
  ownCategoryId,
  ownCategoryLabel,
  onChange,
}: {
  workspaceId: string;
  categories: BusinessCategory[];
  ownCategoryId: string | null;
  ownCategoryLabel: string | null;
  onChange: (categoryId: string | null, label: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(ownCategoryId);
  const [draftLabel, setDraftLabel] = useState<string>(ownCategoryLabel ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = ownCategoryId ? categories.find((c) => c.id === ownCategoryId) : null;
  const currentLabel = current?.name ?? ownCategoryLabel;

  function openEditor() {
    setDraftId(ownCategoryId);
    setDraftLabel(ownCategoryLabel ?? "");
    setError(null);
    setEditing(true);
  }

  function confirm() {
    if (!draftId && !draftLabel.trim()) return;
    setError(null);
    // Mise à jour immédiate côté client — le reste du parcours (objectif,
    // cibles, signaux, score) doit changer SANS attendre la réponse serveur.
    onChange(draftId, draftId ? null : draftLabel.trim());
    setEditing(false);
    startTransition(async () => {
      const result = await updateOwnCategory(workspaceId, draftId, draftId ? null : draftLabel.trim());
      if (!result.ok) setError(result.error ?? "Échec de l'enregistrement — la modification reste appliquée ici mais n'a pas pu être sauvegardée.");
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2.5">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Votre activité</p>
          <p className="text-[15px] font-bold text-ink">
            {current?.icon ? `${current.icon} ` : ""}
            {currentLabel ?? "Non renseignée"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openEditor}>
          Modifier
        </Button>
        {pending && <span className="text-[11px] text-faint">Enregistrement…</span>}
        {error && <span className="text-[11px] font-medium text-red-fg">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-accent/40 bg-accent/[0.04] p-3.5">
      <p className="text-[12.5px] font-bold text-ink">Quelle est votre activité ?</p>
      <CategoryCombobox
        categories={categories}
        value={draftId}
        onChange={setDraftId}
        customLabel={draftLabel}
        onCustomLabelChange={setDraftLabel}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={confirm} disabled={!draftId && !draftLabel.trim()}>
          Confirmer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
