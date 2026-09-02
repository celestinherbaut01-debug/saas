-- Abonnements : table dédiée pour accueillir les futurs champs Stripe, plutôt
-- que de continuer à ne se fier qu'à workspaces.plan. Le plan réellement actif
-- est désormais lu ici. Aucune écriture cliente : seul un futur webhook Stripe
-- (service role) ou l'admin doit modifier cette table.

create table if not exists public.subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'max')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  billing_period text check (billing_period in ('monthly', 'yearly')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "subscriptions: members can read" on public.subscriptions
  for select using (public.is_workspace_member(workspace_id));
-- Pas de policy insert/update/delete côté client : seul le service role (le
-- futur webhook Stripe, phase 9) peut écrire ici.

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Un workspace créé = un abonnement Starter par défaut, immédiatement.
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (workspace_id, plan)
  values (new.id, 'starter')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Backfill pour les workspaces déjà créés avant cette migration.
insert into public.subscriptions (workspace_id, plan)
select id, plan from public.workspaces
on conflict (workspace_id) do nothing;
