-- Planning réellement interactif — audit confirmé : aucune table
-- calendrier n'existait. L'onglet "Planning" (garage/cleaning/agency)
-- n'était qu'une liste dérivée en lecture seule des échéances de tâches/
-- projets/ordres de réparation, sans aucun moyen d'ajouter un événement
-- indépendant ("Ajoutez une échéance..." sans bouton pour le faire).
--
-- Table générique (pas une par verticale) : un événement de planning a le
-- même besoin partout (titre, créneau, liens optionnels vers client/
-- projet/membre d'équipe, notes) — seul le VOCABULAIRE affiché change par
-- métier (rendez-vous atelier / intervention / visite...), géré côté
-- application via `kind`, jamais par une table séparée par verticale.
create table if not exists public.planning_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at >= starts_at),
  kind text not null default 'other' check (kind in ('appointment', 'deadline', 'intervention', 'visit', 'maintenance', 'other')),
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  notes text not null default '',
  status text not null default 'planned' check (status in ('planned', 'done', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_entries enable row level security;
drop policy if exists "planning_entries: members all" on public.planning_entries;
create policy "planning_entries: members all" on public.planning_entries
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists planning_entries_workspace_idx on public.planning_entries(workspace_id, starts_at);

drop trigger if exists planning_entries_set_updated_at on public.planning_entries;
create trigger planning_entries_set_updated_at
  before update on public.planning_entries
  for each row execute function public.set_updated_at();
