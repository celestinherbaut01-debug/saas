-- complete_onboarding (0009) faisait : "si l'utilisateur a déjà un
-- workspace, le renvoyer tel quel". C'était sûr tant que complete_onboarding
-- était le SEUL chemin de création de workspace. Mais certains comptes ont
-- un workspace orphelin créé par l'ancien code (avant 0009), à une époque
-- où business_profiles n'existait pas encore côté base — ce workspace n'a
-- donc jamais eu de profil.
--
-- Corrigé pour être auto-réparateur : réutilise le workspace existant s'il y
-- en a un, mais crée/complète TOUJOURS business_profiles et
-- workspace_targets (upsert), au lieu de s'arrêter dès qu'un workspace est
-- trouvé. Rejouable sans risque, ne supprime aucune donnée.

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

  perform public.award_xp(v_workspace_id, 'onboarding_completed', 50, null, true);

  return v_workspace_id;
end;
$$;
