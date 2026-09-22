-- BUSINESS TWIN — anti-répétition + explicabilité du levier réel choisi
-- (voir audit du 2026-09 : les scénarios A/B/C ne représentaient souvent
-- que des variantes de texte du même signal, et rien n'empêchait de
-- représenter deux fois la même recommandation comme "nouvelle").
--
-- `lever`/`signal_category` identifient le VRAI levier stratégique derrière
-- un scénario (ex. "reactivation_direct" vs "reactivation_bulk_campaign"),
-- distinct de `key` (qui ne dit que la position A/B/C, déjà en base depuis
-- 0031). `fingerprint`/`is_repeat`/`first_seen_at` permettent de dire
-- "cette recommandation reste valable" plutôt que de la présenter comme
-- neuve à chaque simulation quand rien n'a changé.

alter table public.scenario_results add column if not exists lever text;
alter table public.scenario_results add column if not exists signal_category text;
alter table public.scenario_results add column if not exists fingerprint text;
alter table public.scenario_results add column if not exists is_repeat boolean not null default false;
-- Renseigné uniquement quand is_repeat = true : date de la toute première
-- apparition de ce fingerprint pour ce workspace (voir recommendation_
-- fingerprints.first_seen_at ci-dessous), affichée par l'UI ("reste valable
-- depuis le ...") au lieu de la date de CE scénario (qui, elle, est
-- toujours "aujourd'hui").
alter table public.scenario_results add column if not exists first_seen_at timestamptz;

create index if not exists scenario_results_fingerprint_idx on public.scenario_results(workspace_id, fingerprint);

-- ---------------------------------------------------------------------------
-- recommendation_fingerprints : registre des recommandations déjà vues par
-- workspace. Le fingerprint est calculé côté serveur (lib/actions/business-
-- twin.ts) à partir de workspace_id + goal_type + lever + valeurs
-- importantes BUCKETÉES (pas les valeurs exactes, qui changeraient à
-- chaque simulation même sans changement réel de situation) + une période
-- (semaine ISO), pour qu'une recommandation redevienne "nouvelle" après un
-- temps raisonnable même si rien n'a changé, plutôt que de rester
-- supprimée indéfiniment.
-- ---------------------------------------------------------------------------
create table if not exists public.recommendation_fingerprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fingerprint text not null,
  goal_type text not null,
  lever text not null,
  label text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  times_seen integer not null default 1,
  unique (workspace_id, fingerprint)
);

alter table public.recommendation_fingerprints enable row level security;
drop policy if exists "recommendation_fingerprints: members all" on public.recommendation_fingerprints;
create policy "recommendation_fingerprints: members all" on public.recommendation_fingerprints
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists recommendation_fingerprints_workspace_idx on public.recommendation_fingerprints(workspace_id);
