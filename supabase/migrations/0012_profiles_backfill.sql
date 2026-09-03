-- Root cause de "onboarding_completed = undefined" : la ligne public.profiles
-- de cet utilisateur n'existe pas du tout. L'UPDATE dans complete_onboarding
-- (0011) touchait donc 0 ligne, silencieusement (ce n'est pas une erreur
-- SQL) — et le SELECT suivant ne trouve rien non plus, d'où `undefined`
-- côté JS plutôt que `false`.
--
-- Pourquoi la ligne manque : le trigger on_auth_user_created (qui appelle
-- handle_new_user() à chaque INSERT dans auth.users) peut avoir été absent
-- ou non réappliqué à un moment de cette suite de corrections — un compte
-- créé pendant cette fenêtre n'a jamais eu son profil auto-créé. Cette
-- migration répare les deux : le trigger pour l'avenir, et un backfill
-- immédiat pour les comptes déjà existants sans profil.

-- 1) S'assurer que le trigger existe réellement (recréation défensive,
--    idempotente — handle_new_user() lui-même est inchangé).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Backfill : crée la ligne profiles manquante pour tout compte
--    auth.users existant qui n'en a pas encore une. Reprend exactement la
--    logique de handle_new_user() (nom/avatar depuis les métadonnées Google
--    si présentes), sans dupliquer aucune ligne existante.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 3) complete_onboarding devient auto-réparateur pour profiles aussi : crée
-- la ligne si elle manque encore (ceinture + bretelles), avant de la
-- mettre à jour. Reste vrai même si le trigger venait à refaire défaut.
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

  -- Garantit qu'une ligne profiles existe pour cet utilisateur, quoi qu'il
  -- soit arrivé au trigger d'inscription.
  insert into public.profiles (id) values (v_user_id) on conflict (id) do nothing;

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

  foreach v_category_id in array p_target_category_ids loop
    insert into public.workspace_targets (workspace_id, category_id)
    values (v_workspace_id, v_category_id)
    on conflict do nothing;
  end loop;

  update public.profiles set onboarding_completed = true where id = v_user_id;
  get diagnostics v_updated_rows = row_count;
  if v_updated_rows = 0 then
    raise exception 'Échec critique : la mise à jour de profiles.onboarding_completed n''a touché aucune ligne pour user_id=%', v_user_id;
  end if;

  perform public.award_xp(v_workspace_id, 'onboarding_completed', 50, null, true);

  return v_workspace_id;
end;
$$;
