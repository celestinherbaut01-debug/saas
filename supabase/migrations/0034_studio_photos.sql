-- STUDIO IA — photos réelles (upload utilisateur, jamais de base64 en base).
--
-- Bucket public en LECTURE (les photos servent à du contenu marketing
-- destiné à être publié ailleurs — Instagram/Facebook/site — donc aucune
-- information sensible n'y est stockée) mais ISOLÉ PAR WORKSPACE en
-- écriture : chaque objet est rangé sous <workspace_id>/<creation_id>/
-- <fichier>, et seuls les membres du workspace concerné peuvent
-- ajouter/modifier/supprimer — vérifié en extrayant le premier segment du
-- chemin, même principe que is_workspace_member(workspace_id) ailleurs
-- dans ce schéma.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-photos', 'studio-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "studio-photos: public read" on storage.objects;
create policy "studio-photos: public read" on storage.objects
  for select using (bucket_id = 'studio-photos');

drop policy if exists "studio-photos: members write" on storage.objects;
create policy "studio-photos: members write" on storage.objects
  for insert with check (
    bucket_id = 'studio-photos'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "studio-photos: members update" on storage.objects;
create policy "studio-photos: members update" on storage.objects
  for update using (
    bucket_id = 'studio-photos'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "studio-photos: members delete" on storage.objects;
create policy "studio-photos: members delete" on storage.objects
  for delete using (
    bucket_id = 'studio-photos'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- Référence aux photos (jamais le contenu binaire) — l'ordre du tableau
-- fait office d'ordre d'affichage, photos[0] est TOUJOURS la photo
-- principale (pas de colonne is_primary séparée à garder synchronisée).
alter table public.studio_creations add column if not exists photos jsonb not null default '[]'::jsonb;
