"use client";

import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { deleteStudioPhoto, reorderStudioPhoto, setPrimaryStudioPhoto, uploadStudioPhoto } from "@/lib/actions/studio";
import { validatePhotoFile, type StudioPhoto } from "@/lib/studio/photos";

/**
 * Upload réel vers Supabase Storage (voir lib/actions/studio.ts
 * uploadStudioPhoto) — jamais un aperçu local présenté comme sauvegardé :
 * chaque miniature affichée correspond à un fichier déjà en Storage.
 */
export function PhotoUploader({
  workspaceId,
  creationId,
  photos,
  photoUrl,
  onPhotosChange,
}: {
  workspaceId: string;
  creationId: string;
  photos: StudioPhoto[];
  photoUrl: (path: string) => string;
  onPhotosChange: (photos: StudioPhoto[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    for (const file of Array.from(files)) {
      const validationError = validatePhotoFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      startTransition(async () => {
        const result = await uploadStudioPhoto(workspaceId, creationId, file);
        if (!result.ok || !result.path) {
          setError(result.error ?? "Échec de l'envoi.");
          return;
        }
        onPhotosChange([...photos, { path: result.path }]);
      });
    }
  }

  function remove(path: string) {
    startTransition(async () => {
      const result = await deleteStudioPhoto(workspaceId, creationId, path);
      if (!result.ok) {
        setError(result.error ?? "Échec de la suppression.");
        return;
      }
      onPhotosChange(photos.filter((p) => p.path !== path));
    });
  }

  function move(path: string, direction: -1 | 1) {
    const index = photos.findIndex((p) => p.path === path);
    if (index === -1) return;
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    startTransition(async () => {
      const result = await reorderStudioPhoto(workspaceId, creationId, path, direction);
      if (!result.ok) {
        setError(result.error ?? "Échec du réordonnancement.");
        return;
      }
      const next = [...photos];
      [next[index], next[target]] = [next[target], next[index]];
      onPhotosChange(next);
    });
  }

  function makePrimary(path: string) {
    startTransition(async () => {
      const result = await setPrimaryStudioPhoto(workspaceId, creationId, path);
      if (!result.ok) {
        setError(result.error ?? "Échec.");
        return;
      }
      const target = photos.find((p) => p.path === path);
      if (target) onPhotosChange([target, ...photos.filter((p) => p.path !== path)]);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragOver ? "border-accent bg-accent/5" : "border-line bg-soft hover:border-ink/25",
        )}
      >
        <span className="text-2xl">📷</span>
        <p className="text-[13px] font-semibold text-ink">Glissez vos photos ici, ou cliquez pour parcourir</p>
        <p className="text-[11px] text-faint">JPEG, PNG ou WebP — 10 Mo max par photo</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-[12px] font-medium text-red-fg">{error}</p>}
      {pending && <p className="text-[11px] text-faint">Envoi en cours…</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.path} className="group relative overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- photos utilisateur en Storage, dimensions variables */}
              <img src={photoUrl(p.path)} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-[image:var(--gradient-signature)] px-1.5 py-0.5 text-[9px] font-bold text-accent-ink shadow-[var(--shadow-sm)]">
                  Principale
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink/70 px-1 py-1 opacity-0 transition group-hover:opacity-100">
                <button type="button" onClick={() => move(p.path, -1)} disabled={i === 0} className="text-[11px] text-bg disabled:opacity-30" title="Déplacer vers la gauche">
                  ←
                </button>
                {i !== 0 && (
                  <button type="button" onClick={() => makePrimary(p.path)} className="text-[10px] font-semibold text-bg" title="Définir comme principale">
                    ★
                  </button>
                )}
                <button type="button" onClick={() => move(p.path, 1)} disabled={i === photos.length - 1} className="text-[11px] text-bg disabled:opacity-30" title="Déplacer vers la droite">
                  →
                </button>
                <button type="button" onClick={() => remove(p.path)} className="text-[11px] font-bold text-red-300" title="Supprimer">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
