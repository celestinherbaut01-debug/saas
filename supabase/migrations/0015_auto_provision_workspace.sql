-- L'onboarding ne doit plus être une prison qui bloque tout le SaaS : un
-- utilisateur doit pouvoir visiter dashboard/CRM/NOVA/Business OS avant
-- d'avoir terminé sa configuration. Jusqu'ici, le workspace (le conteneur
-- de toutes les données) n'était créé QUE par complete_onboarding — sans
-- lui, aucune page ne pouvait fonctionner, quoi qu'on fasse côté proxy/UI.
--
-- Cette migration détache la création du workspace de l'onboarding : un
-- workspace vide est créé automatiquement dès que le profil existe (donc
-- juste après l'inscription). L'onboarding se contente ensuite de le
-- COMPLÉTER (business_profile, cibles) — voir complete_onboarding (0014),
-- qui réutilise déjà un workspace existant s'il en trouve un.

create or replace function public.handle_new_profile_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  if exists (select 1 from public.workspace_members where user_id = new.id) then
    return new;
  end if;

  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(trim(new.full_name), ''), 'Mon espace'), new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_profile_created_workspace on public.profiles;
create trigger on_profile_created_workspace
  after insert on public.profiles
  for each row execute function public.handle_new_profile_workspace();

-- Backfill : tout profil déjà existant sans workspace en reçoit un
-- maintenant (couvre les comptes créés avant cette migration, y compris
-- pendant les tests de cette conversation).
do $$
declare
  r record;
  v_workspace_id uuid;
begin
  for r in
    select p.id, p.full_name
    from public.profiles p
    where not exists (select 1 from public.workspace_members wm where wm.user_id = p.id)
  loop
    insert into public.workspaces (name, created_by)
    values (coalesce(nullif(trim(r.full_name), ''), 'Mon espace'), r.id)
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, r.id, 'owner');
  end loop;
end $$;
