// Photos Studio — jamais de base64 en base (voir migration 0034_studio_photos
// pour le bucket + RLS par workspace). `studio_creations.photos` ne stocke
// que des chemins d'objets Storage ; photos[0] est TOUJOURS la photo
// principale (ordre du tableau = ordre d'affichage, pas de colonne
// is_primary séparée à garder synchronisée).

export const STUDIO_PHOTOS_BUCKET = "studio-photos";
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface StudioPhoto {
  path: string;
}

export function parsePhotos(raw: unknown): StudioPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is StudioPhoto => Boolean(p && typeof p === "object" && typeof (p as StudioPhoto).path === "string"));
}

function sanitizeFilename(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9.\-]+/g, "-").replace(/-+/g, "-");
  return base.length > 0 ? base : "photo";
}

/** Chemin Storage isolé par workspace puis par création — voir la policy RLS storage.objects (premier segment = workspace_id). */
export function buildPhotoPath(workspaceId: string, creationId: string, filename: string, uniqueSuffix: string): string {
  return `${workspaceId}/${creationId}/${uniqueSuffix}-${sanitizeFilename(filename)}`;
}

export function photoPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${STUDIO_PHOTOS_BUCKET}/${path}`;
}

export function validatePhotoFile(file: { size: number; type: string }): string | null {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) return "Format non supporté — utilisez JPEG, PNG ou WebP.";
  if (file.size > MAX_PHOTO_SIZE_BYTES) return "Fichier trop volumineux (10 Mo maximum).";
  return null;
}

export function addPhoto(photos: StudioPhoto[], photo: StudioPhoto): StudioPhoto[] {
  return [...photos, photo];
}

export function removePhoto(photos: StudioPhoto[], path: string): StudioPhoto[] {
  return photos.filter((p) => p.path !== path);
}

/** Déplace la photo à `index` d'une position (delta -1 ou +1) — reste sans effet si déjà en bout de liste. */
export function movePhoto(photos: StudioPhoto[], index: number, delta: -1 | 1): StudioPhoto[] {
  const target = index + delta;
  if (target < 0 || target >= photos.length) return photos;
  const next = [...photos];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function setPrimaryPhoto(photos: StudioPhoto[], path: string): StudioPhoto[] {
  const target = photos.find((p) => p.path === path);
  if (!target) return photos;
  return [target, ...photos.filter((p) => p.path !== path)];
}
