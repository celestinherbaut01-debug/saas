-- XP / gamification (section 6 du cahier des charges). Récompense la
-- progression commerciale réelle (premier contact, réponse obtenue, RDV,
-- client gagné, profil complété) — jamais le volume d'actions brutes
-- (aucune XP liée à l'envoi d'emails, pour ne pas encourager le spam).
--
-- xp_events est un journal append-only (comme activities) : le total d'XP
-- se calcule en sommant cette table, jamais un compteur mutable séparé qui
-- pourrait diverger.

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  action text not null,
  xp_amount integer not null check (xp_amount > 0),
  created_at timestamptz not null default now()
);

alter table public.xp_events enable row level security;
drop policy if exists "xp_events: members can read" on public.xp_events;
create policy "xp_events: members can read" on public.xp_events
  for select using (public.is_workspace_member(workspace_id));
-- Pas de policy insert/update/delete côté client : uniquement via award_xp()
-- ci-dessous (security definer), pour empêcher un client de s'auto-attribuer
-- de l'XP directement.

create index if not exists xp_events_workspace_idx on public.xp_events(workspace_id, created_at desc);

-- Attribue de l'XP à un workspace. `p_dedupe` = true empêche de ré-attribuer
-- la même action pour le même prospect (ex. repasser un prospect en
-- "won" plusieurs fois ne doit pas repayer 100 XP à chaque fois).
create or replace function public.award_xp(
  p_workspace_id uuid,
  p_action text,
  p_amount integer,
  p_prospect_id uuid default null,
  p_dedupe boolean default false
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Accès refusé à ce workspace';
  end if;

  if p_dedupe and exists (
    select 1 from public.xp_events
    where workspace_id = p_workspace_id
      and action = p_action
      and prospect_id is not distinct from p_prospect_id
  ) then
    return false;
  end if;

  insert into public.xp_events (workspace_id, prospect_id, action, xp_amount)
  values (p_workspace_id, p_prospect_id, p_action, p_amount);

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Déclencheurs automatiques, au niveau base de données : fonctionnent quel
-- que soit le chemin de code qui modifie la ligne (Server Action, futur
-- NOVA, etc.), pas seulement un point d'entrée précis.
-- ---------------------------------------------------------------------------
create or replace function public.trg_award_xp_prospect_added()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.award_xp(new.workspace_id, 'prospect_added', 5, new.id, false);
  return new;
end;
$$;

drop trigger if exists xp_on_prospect_added on public.prospects;
create trigger xp_on_prospect_added
  after insert on public.prospects
  for each row execute function public.trg_award_xp_prospect_added();

create or replace function public.trg_award_xp_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'contacted' then
      perform public.award_xp(new.workspace_id, 'status_contacted', 10, new.id, true);
    elsif new.status = 'replied' then
      perform public.award_xp(new.workspace_id, 'status_replied', 20, new.id, true);
    elsif new.status = 'won' then
      perform public.award_xp(new.workspace_id, 'status_won', 100, new.id, true);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists xp_on_status_change on public.prospects;
create trigger xp_on_status_change
  after update of status on public.prospects
  for each row execute function public.trg_award_xp_status_change();

create or replace function public.trg_award_xp_appointment_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.award_xp(new.workspace_id, 'appointment_created', 15, new.prospect_id, false);
  return new;
end;
$$;

drop trigger if exists xp_on_appointment_created on public.appointments;
create trigger xp_on_appointment_created
  after insert on public.appointments
  for each row execute function public.trg_award_xp_appointment_created();
