-- Onboarding : "Je ne trouve pas mon métier" ne doit jamais bloquer
-- l'inscription (règle produit explicite). Jusqu'ici, own_category_id
-- était le SEUL moyen de dire quel métier on exerce — si le métier
-- n'existait pas dans le catalogue, il n'y avait aucune façon de le
-- signaler : l'utilisateur passait juste l'étape sans rien laisser.
--
-- own_category_label capture ce cas : rempli UNIQUEMENT quand
-- own_category_id est null ET que l'utilisateur a tapé un intitulé libre
-- ("Je ne trouve pas mon métier" -> "Proposer ce métier"). Le profil reste
-- générique (Business OS socle) tant que ce métier n'est pas ajouté au
-- catalogue — jamais un blocage, jamais une case forcée à choisir dans
-- une liste incomplète.
alter table public.business_profiles add column if not exists own_category_label text;

drop function if exists public.complete_onboarding(
  text, text, text, text, uuid, text, text, text, double precision, double precision, uuid[], numeric, text
);

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
  p_target_category_ids uuid[],
  p_radius_km numeric default null,
  p_product_mode text default 'both',
  p_own_category_label text default null
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
  v_radius numeric := coalesce(p_radius_km, 10);
  v_product_mode text := coalesce(p_product_mode, 'both');
  -- Le libellé libre n'a de sens que si aucun métier catalogue n'a été
  -- choisi — sinon own_category_id fait déjà foi, pas la peine de garder
  -- un texte redondant qui pourrait diverger du nom réel de la catégorie.
  v_own_category_label text := case when p_own_category_id is null then nullif(trim(coalesce(p_own_category_label, '')), '') else null end;
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
  if v_product_mode not in ('acquisition', 'business_os', 'both') then
    v_product_mode := 'both';
  end if;
  if v_product_mode <> 'business_os'
     and (p_target_category_ids is null or array_length(p_target_category_ids, 1) is null) then
    raise exception 'Sélectionnez au moins un métier à démarcher.';
  end if;
  if v_radius < 0.5 or v_radius > 250 then
    v_radius := 10;
  end if;

  insert into public.profiles (id, onboarding_completed)
  values (v_user_id, false)
  on conflict (id) do nothing;

  select exists (select 1 from public.profiles where id = v_user_id) into v_profile_exists;
  if not v_profile_exists then
    raise exception 'Échec critique : impossible de créer/trouver public.profiles pour user_id=%', v_user_id;
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
    own_category_id, own_category_label, street, postal_code, city, lat, lng, default_radius_km, product_mode
  ) values (
    v_workspace_id, trim(p_company_name), nullif(trim(coalesce(p_website, '')), ''), coalesce(p_offer_description, ''),
    coalesce(p_audience, 'both'), p_own_category_id, v_own_category_label, coalesce(p_street, ''), coalesce(p_postal_code, ''),
    coalesce(p_city, ''), p_lat, p_lng, v_radius, v_product_mode
  )
  on conflict (workspace_id) do update set
    company_name = excluded.company_name,
    website = excluded.website,
    offer_description = excluded.offer_description,
    audience = excluded.audience,
    own_category_id = excluded.own_category_id,
    own_category_label = excluded.own_category_label,
    street = excluded.street,
    postal_code = excluded.postal_code,
    city = excluded.city,
    lat = excluded.lat,
    lng = excluded.lng,
    product_mode = excluded.product_mode;

  foreach v_category_id in array p_target_category_ids loop
    insert into public.workspace_targets (workspace_id, category_id)
    values (v_workspace_id, v_category_id)
    on conflict do nothing;
  end loop;

  update public.profiles set onboarding_completed = true where id = v_user_id;
  get diagnostics v_updated_rows = row_count;
  if v_updated_rows = 0 then
    raise exception 'Échec critique : UPDATE profiles.onboarding_completed a touché 0 ligne pour user_id=%', v_user_id;
  end if;

  select onboarding_completed into v_final_onboarding_completed
  from public.profiles where id = v_user_id;
  if v_final_onboarding_completed is distinct from true then
    raise exception 'Échec critique : profiles.onboarding_completed = % après re-lecture (attendu true) pour user_id=%', v_final_onboarding_completed, v_user_id;
  end if;

  perform public.award_xp(v_workspace_id, 'onboarding_completed', 50, null, true);

  return v_workspace_id;
end;
$$;

revoke all on function public.complete_onboarding(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  uuid[],
  numeric,
  text,
  text
) from public;

grant execute on function public.complete_onboarding(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  uuid[],
  numeric,
  text,
  text
) to authenticated;
