-- STUDIO IA — transforme une offre (produit/service/bien/réalisation/
-- événement/promotion) en contenu multi-canal (Instagram/Facebook/Email/
-- Site/SMS), sans jamais inventer de caractéristique non fournie par
-- l'utilisateur (voir lib/studio/generator.ts). Deux tables :
-- 1. brand_kits : identité visuelle/ton réutilisée automatiquement par le
--    générateur (une ligne par workspace).
-- 2. studio_creations : bibliothèque de contenus générés, avec un cycle de
--    vie honnête (brouillon -> prêt -> publié -> archivé) — "publié" est un
--    statut que l'UTILISATEUR coche lui-même après avoir posté ailleurs,
--    jamais une vraie publication automatique (pas d'intégration Meta API).

create table if not exists public.brand_kits (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  tone text not null default 'professionnel' check (tone in ('professionnel', 'chaleureux', 'dynamique', 'premium')),
  primary_color text not null default '#111111',
  accent_color text not null default '#2563eb',
  tagline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_kits enable row level security;
drop policy if exists "brand_kits: members all" on public.brand_kits;
create policy "brand_kits: members all" on public.brand_kits
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop trigger if exists brand_kits_set_updated_at on public.brand_kits;
create trigger brand_kits_set_updated_at before update on public.brand_kits
  for each row execute function public.set_updated_at();

create table if not exists public.studio_creations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  vertical text not null,
  offer_type text not null check (offer_type in ('produit', 'service', 'bien', 'realisation', 'evenement', 'promotion')),
  title text not null,
  -- Champs saisis par l'utilisateur pour CETTE création (forme dépend de
  -- offer_type, voir lib/studio/types.ts StudioInput) — jamais complétés
  -- automatiquement par le générateur, qui ne fait que composer ces champs.
  input_data jsonb not null default '{}'::jsonb,
  -- Contenu généré par canal (voir lib/studio/generator.ts GeneratedContent),
  -- régénérable à tout moment à partir de input_data + brand_kits — jamais
  -- la source de vérité des faits, seulement du texte composé.
  generated_content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'archived')),
  -- Présent uniquement quand la création vient d'une action Business Twin
  -- (ex. levier reactivation_bulk_campaign) — jamais une jointure obligatoire.
  source_mission_id uuid references public.missions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_creations enable row level security;
drop policy if exists "studio_creations: members all" on public.studio_creations;
create policy "studio_creations: members all" on public.studio_creations
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop trigger if exists studio_creations_set_updated_at on public.studio_creations;
create trigger studio_creations_set_updated_at before update on public.studio_creations
  for each row execute function public.set_updated_at();

create index if not exists studio_creations_workspace_idx on public.studio_creations(workspace_id, status);
