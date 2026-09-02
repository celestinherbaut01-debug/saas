-- Timeline d'activité par prospect : ce que l'utilisateur (ou plus tard NOVA)
-- a réellement fait, jamais une reconstruction a posteriori.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  type text not null check (type in (
    'added_to_crm', 'status_change', 'note', 'email_sent', 'followup_sent',
    'reply_received', 'call_logged', 'google_verified', 'website_audited', 'appointment_created'
  )),
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;
drop policy if exists "activities: members all" on public.activities;
create policy "activities: members all" on public.activities
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists activities_prospect_idx on public.activities(prospect_id, created_at desc);
create index if not exists activities_workspace_idx on public.activities(workspace_id);
