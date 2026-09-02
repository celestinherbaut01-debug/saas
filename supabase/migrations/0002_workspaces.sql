-- Passage à une architecture multi-tenant par workspace (Phase 1).
--
-- Avant : les données étaient rattachées directement à auth.uid() (un compte
-- = une entreprise). Ça ne permet pas d'inviter des collègues plus tard.
-- Après : un WORKSPACE (l'entreprise) a des MEMBRES (les comptes). Toutes les
-- données métier (profil entreprise, cibles de prospection, prospects, zones
-- de recherche) sont rattachées au workspace, jamais à un user_id.
--
-- Rien n'est encore déployé en production à ce stade : on modifie donc les
-- tables de 0001_init_schema.sql directement plutôt que d'empiler des
-- migrations correctives.

-- ---------------------------------------------------------------------------
-- workspaces + membres
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'max')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

-- Fonction utilitaire pour les policies RLS : l'utilisateur courant
-- appartient-il à ce workspace ? `security definer` pour pouvoir être
-- appelée depuis les policies de n'importe quelle table sans dépendre de
-- policies récursives sur workspace_members elle-même.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "workspaces: members can read" on public.workspaces;
create policy "workspaces: members can read" on public.workspaces
  for select using (public.is_workspace_member(id));
drop policy if exists "workspaces: creator can insert" on public.workspaces;
create policy "workspaces: creator can insert" on public.workspaces
  for insert with check (created_by = auth.uid());
drop policy if exists "workspaces: members can update" on public.workspaces;
create policy "workspaces: members can update" on public.workspaces
  for update using (public.is_workspace_member(id)) with check (public.is_workspace_member(id));

drop policy if exists "workspace_members: members can read own workspace roster" on public.workspace_members;
create policy "workspace_members: members can read own workspace roster" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
-- L'ajout de membres se fait uniquement via la fonction ci-dessous
-- (le créateur du workspace s'auto-ajoute comme owner), pas par insert direct
-- côté client : évite qu'un membre s'auto-promeuve ou ajoute n'importe qui.
drop policy if exists "workspace_members: self insert as creator" on public.workspace_members;
create policy "workspace_members: self insert as creator" on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.workspaces w where w.id = workspace_id and w.created_by = auth.uid())
  );

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles : redevient une table d'IDENTITÉ (un compte), plus une entreprise.
-- Les infos entreprise vont dans business_profiles (rattaché au workspace).
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop column if exists company,
  drop column if exists business_type,
  drop column if exists activity,
  drop column if exists offer,
  drop column if exists street,
  drop column if exists postal_code,
  drop column if exists city,
  drop column if exists lat,
  drop column if exists lng,
  drop column if exists default_radius_km,
  drop column if exists tone,
  drop column if exists signature,
  drop column if exists instruction,
  drop column if exists plan;

alter table public.profiles
  add column if not exists full_name text not null default '',
  add column if not exists avatar_url text,
  add column if not exists onboarding_completed boolean not null default false;

-- Le trigger handle_new_user (0001) reste tel quel : il crée juste la ligne
-- d'identité. On y ajoute le nom depuis les métadonnées Google si présentes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- business_profiles : l'entreprise du workspace (étape 1 de l'onboarding).
-- ---------------------------------------------------------------------------
create table if not exists public.business_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  company_name text not null default '',
  website text,
  offer_description text not null default '',
  audience text not null default 'both' check (audience in ('b2b', 'b2c', 'both')),
  own_category_id uuid, -- FK ajoutée après business_categories plus bas
  street text not null default '',
  postal_code text not null default '',
  city text not null default '',
  lat double precision,
  lng double precision,
  default_radius_km numeric not null default 20 check (default_radius_km between 0.5 and 250),
  tone text not null default 'pro',
  signature text not null default '',
  agent_instruction text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_profiles enable row level security;
drop policy if exists "business_profiles: members all" on public.business_profiles;
create policy "business_profiles: members all" on public.business_profiles
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- business_categories : catalogue de métiers, arborescent et cherchable.
-- Conçu pour scaler à des milliers de lignes sans changement de code UI :
-- la recherche se fait sur `search_text` (nom + mots-clés, sans accents),
-- avec un index trigram pour du "contient" rapide même sur un mot partiel
-- ("digi" doit trouver "digitopuncture"). Le regroupement se fait sur `parent_id`.
-- ---------------------------------------------------------------------------
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

create table if not exists public.business_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.business_categories(id) on delete cascade,
  slug text not null unique,
  name text not null,
  icon text,
  naf_codes text[] not null default '{}',
  keywords text[] not null default '{}', -- recherche : synonymes, variantes, fautes courantes
  sort_order int not null default 0,
  search_text text generated always as (
    lower(unaccent(name || ' ' || array_to_string(keywords, ' ')))
  ) stored
);

create index if not exists business_categories_parent_idx on public.business_categories(parent_id);
create index if not exists business_categories_search_idx
  on public.business_categories using gin(search_text gin_trgm_ops);

alter table public.business_categories enable row level security;
drop policy if exists "business_categories: readable by any authenticated user" on public.business_categories;
create policy "business_categories: readable by any authenticated user" on public.business_categories
  for select using (auth.role() = 'authenticated');
-- Pas de policy insert/update/delete : catalogue partagé, géré par migration/admin.

alter table public.business_profiles drop constraint if exists business_profiles_own_category_fk;
alter table public.business_profiles
  add constraint business_profiles_own_category_fk
  foreign key (own_category_id) references public.business_categories(id);

-- ---------------------------------------------------------------------------
-- workspace_targets : les métiers que CE workspace veut démarcher.
-- Distinct de business_profiles.own_category_id (le métier DU workspace).
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_targets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.business_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, category_id)
);

alter table public.workspace_targets enable row level security;
drop policy if exists "workspace_targets: members all" on public.workspace_targets;
create policy "workspace_targets: members all" on public.workspace_targets
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Rattache prospects / search_zones au workspace plutôt qu'à user_id.
-- ---------------------------------------------------------------------------
alter table public.search_zones add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prospects add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

drop policy if exists "search_zones: owner all" on public.search_zones;
drop policy if exists "prospects: owner all" on public.prospects;

alter table public.search_zones drop column if exists user_id;
alter table public.prospects drop column if exists user_id;

alter table public.search_zones alter column workspace_id set not null;
alter table public.prospects alter column workspace_id set not null;

drop index if exists search_zones_user_idx;
drop index if exists prospects_user_idx;
drop index if exists prospects_user_status_idx;
create index if not exists search_zones_workspace_idx on public.search_zones(workspace_id);
create index if not exists prospects_workspace_idx on public.prospects(workspace_id);
create index if not exists prospects_workspace_status_idx on public.prospects(workspace_id, status);

alter table public.prospects drop constraint if exists prospects_user_id_siret_key;
alter table public.prospects drop constraint if exists prospects_workspace_siret_key;
alter table public.prospects add constraint prospects_workspace_siret_key unique (workspace_id, siret);

drop policy if exists "search_zones: members all" on public.search_zones;
create policy "search_zones: members all" on public.search_zones
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "prospects: members all" on public.prospects;
create policy "prospects: members all" on public.prospects
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
