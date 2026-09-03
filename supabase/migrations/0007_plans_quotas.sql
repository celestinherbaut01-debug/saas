-- Phase de finalisation : introduit le plan FREE (offre d'essai) et une vraie
-- table de compteurs d'usage mensuels, pour que les quotas par plan
-- (requêtes NOVA, prospects ajoutés) soient vérifiés côté serveur — jamais
-- seulement masqués côté client.

-- ---------------------------------------------------------------------------
-- Plan FREE : ajouté aux contraintes existantes, sans toucher aux données.
-- ---------------------------------------------------------------------------
alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces
  add constraint workspaces_plan_check check (plan in ('free', 'starter', 'pro', 'max'));
alter table public.workspaces alter column plan set default 'free';

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check check (plan in ('free', 'starter', 'pro', 'max'));
alter table public.subscriptions alter column plan set default 'free';

-- Les nouveaux workspaces démarrent désormais sur FREE (plan d'essai), plus
-- sur Starter. Les workspaces déjà créés gardent leur plan actuel.
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (workspace_id, plan)
  values (new.id, 'free')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- usage_counters : un compteur par workspace / période (YYYY-MM) / métrique
-- (ex. 'nova_requests', 'prospects_added'). Remis à zéro naturellement au
-- changement de mois puisque period_key change.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_key text not null, -- format 'YYYY-MM', calculé côté serveur (UTC)
  metric text not null check (metric in ('nova_requests', 'prospects_added', 'searches')),
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, period_key, metric)
);

alter table public.usage_counters enable row level security;
drop policy if exists "usage_counters: members can read" on public.usage_counters;
create policy "usage_counters: members can read" on public.usage_counters
  for select using (public.is_workspace_member(workspace_id));
-- Pas de policy insert/update/delete côté client : seule la fonction
-- increment_usage ci-dessous (security definer) peut écrire, après avoir
-- elle-même vérifié l'appartenance au workspace.

-- Incrémente (ou crée) le compteur et retourne la nouvelle valeur. Appelée
-- depuis les Server Actions après une action réussie (jamais avant, pour ne
-- pas compter un appel qui a échoué).
create or replace function public.increment_usage(
  p_workspace_id uuid,
  p_period_key text,
  p_metric text,
  p_amount integer default 1
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Accès refusé à ce workspace';
  end if;

  insert into public.usage_counters (workspace_id, period_key, metric, count)
  values (p_workspace_id, p_period_key, p_metric, p_amount)
  on conflict (workspace_id, period_key, metric)
  do update set count = usage_counters.count + excluded.count, updated_at = now()
  returning count into new_count;

  return new_count;
end;
$$;

create index if not exists usage_counters_workspace_idx on public.usage_counters(workspace_id, period_key);
