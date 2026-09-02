-- ProspectFlow OS — schéma initial (plan Starter)
-- Un profil = un utilisateur = une entreprise (workspace multi-utilisateur à ajouter plus tard pour Pro/Max).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles : paramètres entreprise utilisés pour la recherche + le futur agent
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company text not null default '',
  business_type text not null default 'generic',
  activity text not null default '',
  offer text not null default '',
  street text not null default '',
  postal_code text not null default '',
  city text not null default '',
  lat double precision,
  lng double precision,
  default_radius_km numeric not null default 20 check (default_radius_km between 0.5 and 250),
  tone text not null default 'pro',
  signature text not null default '',
  instruction text not null default '',
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'max')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: owner insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Crée automatiquement un profil vide à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- search_zones : adresses de départ validées (géocodées), réutilisables
-- ---------------------------------------------------------------------------
create table if not exists public.search_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  street text not null default '',
  postal_code text not null default '',
  city text not null default '',
  lat double precision not null,
  lng double precision not null,
  radius_km numeric not null check (radius_km between 0.5 and 250),
  created_at timestamptz not null default now()
);

alter table public.search_zones enable row level security;

create policy "search_zones: owner all" on public.search_zones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists search_zones_user_idx on public.search_zones(user_id);

-- ---------------------------------------------------------------------------
-- prospects : le CRM. Une ligne = un établissement (SIRET) vérifié pour un user.
-- ---------------------------------------------------------------------------
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  siren text not null,
  siret text not null,
  company_name text not null,
  category_id text,
  naf_code text,

  street text,
  postal_code text,
  city text,
  lat double precision,
  lng double precision,
  distance_km numeric,

  -- Registre (SIRENE / RNE via recherche-entreprises.api.gouv.fr)
  legal_status text,             -- 'active' | 'closed'
  nature_juridique text,
  effectif_tranche text,
  is_association boolean not null default false,
  is_large_group boolean not null default false,
  is_chain boolean not null default false,

  -- Google Places
  place_id text,
  business_status text,          -- 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | 'unverified'
  website_uri text,
  website_quality text,          -- 'none' | 'weak' | 'ok' | 'unknown'
  phone text,
  google_rating numeric,
  google_rating_count integer,
  places_checked_at timestamptz,

  quality_score integer not null default 0 check (quality_score between 0 and 100),
  verification_sources jsonb not null default '{}'::jsonb,

  status text not null default 'new' check (status in ('new','to_contact','contacted','replied','won','lost')),
  notes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, siret)
);

alter table public.prospects enable row level security;

create policy "prospects: owner all" on public.prospects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists prospects_user_idx on public.prospects(user_id);
create index if not exists prospects_user_status_idx on public.prospects(user_id, status);
create index if not exists prospects_siren_idx on public.prospects(siren);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prospects_set_updated_at on public.prospects;
create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- verification_cache : résultats Google Places mutualisés par SIRET, pour ne
-- pas repayer un appel API à chaque recherche qui retombe sur le même établissement.
-- Écrit uniquement par l'Edge Function (service role) ; lecture publique pour
-- les utilisateurs authentifiés uniquement (pas de donnée sensible dedans).
-- ---------------------------------------------------------------------------
create table if not exists public.verification_cache (
  siret text primary key,
  place_id text,
  business_status text,
  website_uri text,
  phone text,
  google_rating numeric,
  google_rating_count integer,
  website_quality text,
  raw jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

alter table public.verification_cache enable row level security;

create policy "verification_cache: authenticated read" on public.verification_cache
  for select using (auth.role() = 'authenticated');

-- Pas de policy insert/update/delete : seul le service role (Edge Function),
-- qui contourne RLS, peut écrire dans ce cache.

create index if not exists verification_cache_checked_at_idx on public.verification_cache(checked_at);
