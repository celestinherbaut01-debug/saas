-- Correctif final et définitif pour public.profiles / onboarding.
--
-- Contexte : malgré 0012, le symptôme persiste avec found=false après le
-- RPC — signe que ce projet Supabase exécute encore une version antérieure
-- de complete_onboarding (celle d'avant l'auto-réparation), pas 0012.
-- Cette migration consolide tout en UN seul fichier idempotent, avec des
-- vérifications explicites à chaque étape (jamais un échec silencieux).

-- ---------------------------------------------------------------------------
-- 1) Colonnes obligatoires de public.profiles : vérifiées une par une avec
--    IF NOT EXISTS. Toutes ont un default -> aucune ne peut faire échouer
--    un `insert into public.profiles (id)`.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists full_name text not null default '',
  add column if not exists avatar_url text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2) handle_new_user() : recréée à l'identique (idempotent).
-- ---------------------------------------------------------------------------
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
-- 3) Trigger : recréation défensive. C'est la vraie ligne à vérifier dans
--    Supabase (Database -> Triggers), pas seulement dans le code.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4) Backfill : tout auth.users sans profiles en reçoit un maintenant.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) complete_onboarding : version finale, qui vérifie réellement chaque
--    étape au lieu de supposer qu'elle a réussi.
-- ---------------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_company_name text,
  p_website text,
  p_offer_description text,
  p_audience text,
  p_own_category_id uuid,
  p_street text,
  p_postal_code text,
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric,
  p_target_category_ids uuid[]
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_category_id uuid;
  v_updated_rows int;
  v_profile_exists boolean;
  v_final_onboarding_completed boolean;
begin
  if v_user_id is null then
    raise exception 'Session expirée — reconnectez-vous.';
  end if;
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Le nom de l''entreprise est requis.';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Adresse de départ manquante — validez une adresse.';
  end if;
  if p_target_category_ids is null or array_length(p_target_category_ids, 1) is null then
    raise exception 'Sélectionnez au moins un métier à démarcher.';
  end if;
  if p_radius_km is null or p_radius_km < 0.5 or p_radius_km > 250 then
    raise exception 'Rayon invalide (0.5 à 250 km).';
  end if;

  -- Étape 1 : garantit une ligne profiles, PUIS vérifie réellement qu'elle
  -- existe (ne suppose jamais qu'un insert a réussi).
  insert into public.profiles (id, onboarding_completed)
  values (v_user_id, false)
  on conflict (id) do nothing;

  select exists (select 1 from public.profiles where id = v_user_id) into v_profile_exists;
  if not v_profile_exists then
    raise exception 'Échec critique : impossible de créer/trouver public.profiles pour user_id=%', v_user_id;
  end if;

  -- Étape 2 : workspace (réutilise l'existant si déjà là).
  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = v_user_id
  limit 1;

  if v_workspace_id is null then
    insert into public.workspaces (name, created_by)
    values (trim(p_company_name), v_user_id)
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_user_id, 'owner');
  end if;

  -- Étape 3 : business_profile (upsert).
  insert into public.business_profiles (
    workspace_id, company_name, website, offer_description, audience,
    own_category_id, street, postal_code, city, lat, lng, default_radius_km
  ) values (
    v_workspace_id, trim(p_company_name), nullif(trim(coalesce(p_website, '')), ''), coalesce(p_offer_description, ''),
    coalesce(p_audience, 'both'), p_own_category_id, coalesce(p_street, ''), coalesce(p_postal_code, ''),
    coalesce(p_city, ''), p_lat, p_lng, p_radius_km
  )
  on conflict (workspace_id) do update set
    company_name = excluded.company_name,
    website = excluded.website,
    offer_description = excluded.offer_description,
    audience = excluded.audience,
    own_category_id = excluded.own_category_id,
    street = excluded.street,
    postal_code = excluded.postal_code,
    city = excluded.city,
    lat = excluded.lat,
    lng = excluded.lng,
    default_radius_km = excluded.default_radius_km;

  -- Étape 4 : cibles.
  foreach v_category_id in array p_target_category_ids loop
    insert into public.workspace_targets (workspace_id, category_id)
    values (v_workspace_id, v_category_id)
    on conflict do nothing;
  end loop;

  -- Étape 5 : onboarding_completed = true, avec vérification RÉELLE du
  -- nombre de lignes touchées.
  update public.profiles set onboarding_completed = true where id = v_user_id;
  get diagnostics v_updated_rows = row_count;
  if v_updated_rows = 0 then
    raise exception 'Échec critique : UPDATE profiles.onboarding_completed a touché 0 ligne pour user_id=%', v_user_id;
  end if;

  -- Étape 6 : re-lecture pour confirmer avant de retourner un succès — le
  -- RPC ne doit réussir QUE SI l'état final est réellement vérifié.
  select onboarding_completed into v_final_onboarding_completed
  from public.profiles where id = v_user_id;
  if v_final_onboarding_completed is distinct from true then
    raise exception 'Échec critique : profiles.onboarding_completed = % après re-lecture (attendu true) pour user_id=%', v_final_onboarding_completed, v_user_id;
  end if;

  perform public.award_xp(v_workspace_id, 'onboarding_completed', 50, null, true);

  return v_workspace_id;
end;
$$;

revoke all on function public.complete_onboarding from public;
grant execute on function public.complete_onboarding to authenticated;
