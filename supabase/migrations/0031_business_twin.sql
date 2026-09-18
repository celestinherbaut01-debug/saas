-- PROSPECTFLOW BUSINESS TWIN — pipeline OBJECTIF -> SITUATION -> SIMULATION
-- -> PLAN -> ACTIONS -> RÉSULTATS -> AJUSTEMENT.
--
-- Principes qui gouvernent ce schéma (voir lib/business-twin/*.ts) :
-- 1. Rien n'est jamais inventé : `business_twin_snapshots.metrics` ne
--    contient que des faits calculés depuis les vraies tables (via
--    lib/business-os-data.ts), chaque valeur étiquetée real/estimated/
--    hypothesis/insufficient — jamais un nombre nu.
-- 2. `scenario_results` ne contient JAMAIS de montant futur promis — voir
--    `qualitative_impact` (texte) et `confidence` (faible/moyenne/élevée
--    avec explication), pas de pourcentage de certitude fabriqué.
-- 3. Colonnes typées pour tout ce qui doit être filtré/trié (statut,
--    priorité, dates) ; `jsonb` réservé au contenu réellement variable
--    (métriques du snapshot, contenu préparé d'une action, pointeur souple
--    vers l'entité concernée) — même logique que `business_profiles.
--    search_filters`, déjà dans ce schéma.
-- 4. RLS identique partout : `is_workspace_member(workspace_id)` (voir
--    0030_nova_action_log.sql) — `workspace_id` est dupliqué sur chaque
--    table plutôt que remonté par jointure, même choix que
--    `repair_order_parts` déjà dans ce schéma, pour des policies et des
--    requêtes simples.

-- ---------------------------------------------------------------------------
-- business_twin_snapshots : photo de la situation au moment où une mission
-- est créée (ou recalculée lors d'un "ajustement"). Sert de référence pour
-- expliquer d'où viennent les scénarios générés.
-- ---------------------------------------------------------------------------
create table if not exists public.business_twin_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  vertical text not null check (vertical in ('garage', 'cleaning', 'agency', 'restaurant', 'generic')),
  captured_at timestamptz not null default now(),
  -- Chaque entrée suit l'enveloppe DataField (voir lib/business-twin/types.ts) :
  -- {status:'real'|'estimated'|'hypothesis'|'insufficient', value?, ...}.
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.business_twin_snapshots enable row level security;
drop policy if exists "business_twin_snapshots: members all" on public.business_twin_snapshots;
create policy "business_twin_snapshots: members all" on public.business_twin_snapshots
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists business_twin_snapshots_workspace_idx on public.business_twin_snapshots(workspace_id);

-- ---------------------------------------------------------------------------
-- missions : un objectif suivi dans le temps. `chosen_scenario_result_id`
-- est ajouté par ALTER TABLE plus bas (dépendance circulaire avec
-- scenario_results, qui référence lui-même une mission via scenario_runs).
-- ---------------------------------------------------------------------------
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_type text not null check (
    goal_type in (
      'revenue_growth', 'new_customers', 'fill_capacity', 'b2b_contracts',
      'reactivate_customers', 'overdue_payments', 'margin_improvement',
      'stock_reduction', 'retention', 'custom'
    )
  ),
  goal_label text not null,
  goal_target_value numeric,
  goal_target_unit text,
  deadline date,
  status text not null default 'active' check (status in ('active', 'at_risk', 'succeeded', 'failed', 'abandoned')),
  snapshot_id uuid references public.business_twin_snapshots(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.missions enable row level security;
drop policy if exists "missions: members all" on public.missions;
create policy "missions: members all" on public.missions
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists missions_workspace_idx on public.missions(workspace_id);
create index if not exists missions_status_idx on public.missions(workspace_id, status);

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at before update on public.missions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- scenario_runs : une demande de simulation ("Et si je fais ça ?"). Peut
-- exister avant qu'une mission ne soit créée (exploration libre).
-- ---------------------------------------------------------------------------
create table if not exists public.scenario_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  snapshot_id uuid references public.business_twin_snapshots(id) on delete set null,
  goal_type text not null check (
    goal_type in (
      'revenue_growth', 'new_customers', 'fill_capacity', 'b2b_contracts',
      'reactivate_customers', 'overdue_payments', 'margin_improvement',
      'stock_reduction', 'retention', 'custom'
    )
  ),
  prompt text not null,
  created_at timestamptz not null default now()
);

alter table public.scenario_runs enable row level security;
drop policy if exists "scenario_runs: members all" on public.scenario_runs;
create policy "scenario_runs: members all" on public.scenario_runs
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists scenario_runs_workspace_idx on public.scenario_runs(workspace_id);
create index if not exists scenario_runs_mission_idx on public.scenario_runs(mission_id);

-- ---------------------------------------------------------------------------
-- scenario_results : les scénarios A/B/C produits par un run. Jamais de
-- montant futur promis — `qualitative_impact` reste du texte.
-- ---------------------------------------------------------------------------
create table if not exists public.scenario_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scenario_run_id uuid not null references public.scenario_runs(id) on delete cascade,
  -- Identifie quelle routine du plan-builder appliquer si ce scénario est
  -- choisi (voir lib/business-twin/plan-builder.ts) — 'do_nothing' ne
  -- produit jamais d'action.
  key text not null check (key in ('do_nothing', 'primary', 'alternative')),
  label text not null,
  description text not null default '',
  effort text not null check (effort in ('faible', 'moyen', 'eleve')),
  confidence text not null check (confidence in ('faible', 'moyenne', 'elevee')),
  confidence_explanation text not null default '',
  qualitative_impact text not null default '',
  is_recommended boolean not null default false,
  -- Aperçu du plan si ce scénario est choisi (ex. [{"label":"Devis à relancer","count":12}]) —
  -- affiché sur la page de comparaison, jamais utilisé pour créer les vraies
  -- mission_actions (voir plan-builder.ts, qui recalcule sur données fraîches).
  plan_preview jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.scenario_results enable row level security;
drop policy if exists "scenario_results: members all" on public.scenario_results;
create policy "scenario_results: members all" on public.scenario_results
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists scenario_results_workspace_idx on public.scenario_results(workspace_id);
create index if not exists scenario_results_run_idx on public.scenario_results(scenario_run_id);

-- Dépendance circulaire résolue : missions <-> scenario_runs -> scenario_results.
alter table public.missions
  add column if not exists chosen_scenario_result_id uuid references public.scenario_results(id) on delete set null;

-- ---------------------------------------------------------------------------
-- scenario_assumptions : explicabilité d'un scénario — ce qui est réel, une
-- estimation, une hypothèse, ou une donnée manquante (jamais une prose
-- libre non structurée : un type par ligne, filtrable).
-- ---------------------------------------------------------------------------
create table if not exists public.scenario_assumptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scenario_result_id uuid not null references public.scenario_results(id) on delete cascade,
  kind text not null check (kind in ('real', 'estimated', 'hypothesis', 'missing')),
  label text not null,
  explanation text not null default '',
  created_at timestamptz not null default now()
);

alter table public.scenario_assumptions enable row level security;
drop policy if exists "scenario_assumptions: members all" on public.scenario_assumptions;
create policy "scenario_assumptions: members all" on public.scenario_assumptions
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists scenario_assumptions_workspace_idx on public.scenario_assumptions(workspace_id);
create index if not exists scenario_assumptions_result_idx on public.scenario_assumptions(scenario_result_id);

-- ---------------------------------------------------------------------------
-- mission_actions : le plan concret. `target_ref`/`prepared_content` restent
-- en jsonb car leur forme dépend réellement de `action_type` (un pointeur
-- vers un prospect n'a pas la même forme qu'un pointeur vers un devis, un
-- email préparé n'a pas la même forme qu'un script d'appel) — tout ce qui
-- doit être filtré/trié (statut, ordre, échéance) reste une colonne typée.
-- ---------------------------------------------------------------------------
create table if not exists public.mission_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  step_order integer not null default 0,
  action_type text not null check (
    action_type in (
      'relance_devis', 'contact_prospect', 'upsell', 'campagne', 'appel',
      'tache_crm', 'relance_facture', 'reactivation_client', 'autre'
    )
  ),
  title text not null,
  reason text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'ready', 'done', 'skipped')),
  -- Pointeur souple vers l'entité concernée, ex. {"table":"prospects","id":"..."} — jamais résolu en dur ici, toujours relu à la demande (une entité supprimée depuis reste possible).
  target_ref jsonb,
  -- Contenu préparé (email/SMS/texte Facebook/script d'appel...) — jamais envoyé automatiquement, voir server actions.
  prepared_content jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mission_actions enable row level security;
drop policy if exists "mission_actions: members all" on public.mission_actions;
create policy "mission_actions: members all" on public.mission_actions
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists mission_actions_workspace_idx on public.mission_actions(workspace_id);
create index if not exists mission_actions_mission_idx on public.mission_actions(mission_id);
create index if not exists mission_actions_status_idx on public.mission_actions(mission_id, status);

drop trigger if exists mission_actions_set_updated_at on public.mission_actions;
create trigger mission_actions_set_updated_at before update on public.mission_actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- mission_events : fil d'historique d'une mission (page /missions).
-- ---------------------------------------------------------------------------
create table if not exists public.mission_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'created', 'scenario_chosen', 'plan_applied', 'action_done',
      'action_skipped', 'progress_update', 'recommendation', 'blocker', 'status_changed'
    )
  ),
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.mission_events enable row level security;
drop policy if exists "mission_events: members all" on public.mission_events;
create policy "mission_events: members all" on public.mission_events
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists mission_events_workspace_idx on public.mission_events(workspace_id);
create index if not exists mission_events_mission_idx on public.mission_events(mission_id, created_at desc);

-- ---------------------------------------------------------------------------
-- action_outcomes : ce qui s'est réellement passé pour une action proposée
-- (point 15 de la spec — apprentissage sans ML : on enregistre, on
-- n'entraîne rien). `amount_eur` reste NULL tant qu'aucun montant réel
-- (facture payée) n'est connu — jamais une estimation à cet endroit.
-- ---------------------------------------------------------------------------
create table if not exists public.action_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mission_action_id uuid not null references public.mission_actions(id) on delete cascade,
  proposed_at timestamptz not null default now(),
  accepted boolean,
  accepted_at timestamptz,
  result text check (result is null or result in ('converted', 'no_response', 'declined', 'in_progress')),
  amount_eur numeric check (amount_eur is null or amount_eur >= 0),
  time_to_outcome_hours numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.action_outcomes enable row level security;
drop policy if exists "action_outcomes: members all" on public.action_outcomes;
create policy "action_outcomes: members all" on public.action_outcomes
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists action_outcomes_workspace_idx on public.action_outcomes(workspace_id);
create index if not exists action_outcomes_action_idx on public.action_outcomes(mission_action_id);

drop trigger if exists action_outcomes_set_updated_at on public.action_outcomes;
create trigger action_outcomes_set_updated_at before update on public.action_outcomes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quota Business Twin : nouvelle métrique 'scenario_runs' dans usage_counters
-- (voir lib/quota.ts) — le check existant (0007_plans_quotas.sql) doit être
-- élargi pour l'accepter.
-- ---------------------------------------------------------------------------
alter table public.usage_counters drop constraint if exists usage_counters_metric_check;
alter table public.usage_counters
  add constraint usage_counters_metric_check
  check (metric in ('nova_requests', 'prospects_added', 'searches', 'scenario_runs'));
