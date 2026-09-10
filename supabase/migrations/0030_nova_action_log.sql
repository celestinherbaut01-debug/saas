-- NOVA Growth Autopilot : persiste UNIQUEMENT le statut "j'ai traité cette
-- opportunité" (fait/ignorée), jamais les données elles-mêmes (devis,
-- factures, clients... restent lus en direct depuis leurs tables réelles —
-- voir lib/nova-opportunities.ts, qui calcule tout à la volée).
--
-- opportunity_key est un identifiant AGRÉGÉ ("unanswered_quotes",
-- "low_stock"...), pas par entité individuelle : marquer "fait" est donc un
-- snooze de 24h (voir la fenêtre appliquée dans lib/actions/nova-
-- opportunities.ts), pas une suppression permanente — sinon un nouveau
-- devis en retard resterait invisible pour toujours après un premier "fait"
-- sur ce même type de signal.
create table if not exists public.nova_action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_key text not null,
  status text not null check (status in ('done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, opportunity_key)
);

alter table public.nova_action_log enable row level security;

drop policy if exists "nova_action_log: members all" on public.nova_action_log;
create policy "nova_action_log: members all" on public.nova_action_log
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists nova_action_log_workspace_idx on public.nova_action_log(workspace_id);

drop trigger if exists nova_action_log_set_updated_at on public.nova_action_log;
create trigger nova_action_log_set_updated_at before update on public.nova_action_log
  for each row execute function public.set_updated_at();
