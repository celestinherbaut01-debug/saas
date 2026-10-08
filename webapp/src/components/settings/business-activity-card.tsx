"use client";

import { useState, useTransition } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { CategoryCombobox } from "@/components/onboarding/category-combobox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateOwnCategory } from "@/lib/actions/settings";
import { getBusinessOsProfile } from "@/lib/business-os";
import { BUSINESS_OS_REGISTRY } from "@/lib/business-os-registry";

function resolveProfile(categories: BusinessCategory[], categoryId: string | null) {
  if (!categoryId) return getBusinessOsProfile(null, null);
  const cat = categories.find((c) => c.id === categoryId);
  const parentSlug = cat?.parent_id ? categories.find((c) => c.id === cat.parent_id)?.slug ?? null : null;
  return getBusinessOsProfile(parentSlug, cat?.slug ?? null);
}

/**
 * "Quel est mon métier ?" (détermine le Business OS) — distinct et
 * INDÉPENDANT de "qui est-ce que je prospecte ?" (Prospection,
 * workspace_targets) : updateOwnCategory n'écrit que business_profiles.
 * own_category_id/own_category_label, jamais workspace_targets (vérifié).
 * Changer d'activité ici ne supprime aucune donnée existante — seule la
 * RÉSOLUTION du Business OS (vocabulaire, verticale) change.
 */
export function BusinessActivityCard({
  workspaceId,
  categories,
  ownCategoryId,
  ownCategoryLabel,
  onSaved,
}: {
  workspaceId: string;
  categories: BusinessCategory[];
  ownCategoryId: string | null;
  ownCategoryLabel: string | null;
  /** Permet à un appelant (ex. le sélecteur de /business-os) de réagir une fois le changement persisté — ex. rafraîchir la page pour afficher immédiatement le nouveau Business OS. */
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(ownCategoryId);
  const [draftLabel, setDraftLabel] = useState(ownCategoryLabel ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const current = ownCategoryId ? categories.find((c) => c.id === ownCategoryId) : null;
  const currentLabel = current?.name ?? ownCategoryLabel;
  const currentProfile = resolveProfile(categories, ownCategoryId);

  const draftCategory = draftId ? categories.find((c) => c.id === draftId) : null;
  const draftProfile = resolveProfile(categories, draftId);
  const draftDisplayLabel = draftCategory?.name ?? (draftLabel.trim() || null);
  const verticalChanges = draftId !== ownCategoryId && (draftProfile.vertical !== currentProfile.vertical || draftProfile.osName !== currentProfile.osName);

  function openEditor() {
    setDraftId(ownCategoryId);
    setDraftLabel(ownCategoryLabel ?? "");
    setError(null);
    setSaved(false);
    setConfirming(false);
    setEditing(true);
  }

  function requestSave() {
    if (!draftId && !draftLabel.trim()) return;
    if (verticalChanges) {
      setConfirming(true);
      return;
    }
    doSave();
  }

  function doSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateOwnCategory(workspaceId, draftId, draftId ? null : draftLabel.trim());
      if (!result.ok) {
        setError(result.error ?? "Échec de l'enregistrement.");
        return;
      }
      setEditing(false);
      setConfirming(false);
      setSaved(true);
      onSaved?.();
    });
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Activité / métier</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Détermine le Business OS adapté à votre entreprise (vocabulaire, workflow) — indépendant des métiers que vous
        ciblez en Prospection.
      </p>

      {!editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Métier actuel</p>
            <p className="text-[15px] font-bold text-ink">
              {current?.icon ? `${current.icon} ` : ""}
              {currentLabel ?? "Non renseigné"}
              {currentProfile.vertical !== "generic" && <span className="ml-1.5 font-normal text-muted">— {currentProfile.osName}</span>}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openEditor}>
            Modifier
          </Button>
          {saved && <span className="text-[11px] font-medium text-green-fg">✓ Activité mise à jour.</span>}
        </div>
      ) : confirming ? (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-dashed border-accent/40 bg-accent/[0.04] p-3.5">
          <p className="text-[12.5px] leading-relaxed text-ink">
            Votre espace de gestion va être adapté au métier <strong>{draftDisplayLabel}</strong> ({draftProfile.osName}).
            Vos données existantes ne seront pas supprimées.
          </p>
          <div className="text-[11.5px] text-muted">
            <span className="font-semibold text-ink">Modules disponibles : </span>
            {BUSINESS_OS_REGISTRY[draftProfile.vertical].workflow.join(" · ")}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={doSave} disabled={pending}>
              {pending ? "Enregistrement…" : "Confirmer le changement"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-dashed border-accent/40 bg-accent/[0.04] p-3.5">
          <p className="text-[12.5px] font-bold text-ink">Quelle est votre activité ?</p>
          <CategoryCombobox categories={categories} value={draftId} onChange={setDraftId} customLabel={draftLabel} onCustomLabelChange={setDraftLabel} />
          <div className="flex gap-2">
            <Button size="sm" onClick={requestSave} disabled={!draftId && !draftLabel.trim()}>
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] font-medium text-red-fg">{error}</p>}
    </Card>
  );
}
