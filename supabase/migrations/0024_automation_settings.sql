-- Automatisations Business OS par verticale (spec produit §"automatisations
-- par métier") : rappels de rendez-vous configurables (24h/2h/personnalisé),
-- alerte stock bas, alerte renouvellement (domaines/hébergements en agence).
--
-- Portée volontairement limitée aujourd'hui : ceci stocke une PRÉFÉRENCE
-- (quels rappels sont activés) qui pilote ce que les "insights proactifs"
-- NOVA affichent (voir lib/automation-insights.ts) — l'envoi réel (SMS/
-- email) n'est PAS encore branché, c'est une intégration ultérieure. Une
-- ligne par workspace (comme business_profiles), créée à la demande avec
-- des valeurs par défaut raisonnables plutôt qu'un backfill de masse.
create table if not exists public.automation_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  appointment_reminder_24h boolean not null default true,
  appointment_reminder_2h boolean not null default false,
  -- null = rappel personnalisé désactivé ; une valeur = activé à N heures avant.
  custom_reminder_hours_before integer check (custom_reminder_hours_before is null or custom_reminder_hours_before > 0),
  low_stock_alert boolean not null default true,
  renewal_alert boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.automation_settings enable row level security;
drop policy if exists "automation_settings: members all" on public.automation_settings;
create policy "automation_settings: members all" on public.automation_settings
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop trigger if exists automation_settings_set_updated_at on public.automation_settings;
create trigger automation_settings_set_updated_at
  before update on public.automation_settings
  for each row execute function public.set_updated_at();
