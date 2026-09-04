-- Business OS réel par métier (au lieu des 3 modules génériques relabellés
-- de 0006) : chaque famille de métier gagne au moins UNE table qui lui est
-- propre, avec un vrai workflow, pas juste un vocabulaire différent sur
-- "clients/stock/rendez-vous". Portée volontairement limitée à ce qui
-- apporte une vraie différence structurante (voir le rapport final pour ce
-- qui reste hors scope : devis/factures, multi-établissement, rôles fins).

-- Garage : véhicules + ordres de réparation (le workflow central d'un garage).
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  registration text not null,
  make text not null default '',
  model text not null default '',
  year integer,
  mileage integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  status text not null default 'diagnostic'
    check (status in ('diagnostic', 'waiting_parts', 'in_progress', 'done', 'invoiced')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  labor_cost numeric not null default 0,
  parts_cost numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nettoyage : contrats de site (fréquence, prix, renouvellement) — le
-- workflow central d'une entreprise de nettoyage, absent du Business OS générique.
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  site_name text not null,
  frequency text not null default '',
  monthly_price numeric not null default 0,
  renewal_date date,
  status text not null default 'active' check (status in ('active', 'ending_soon', 'ended')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agence web : projets (site/maintenance), avec échéance et budget — le
-- pipeline central d'une agence, distinct d'un simple carnet de clients.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  project_type text not null default 'site' check (project_type in ('site', 'maintenance', 'other')),
  status text not null default 'in_progress' check (status in ('in_progress', 'maintenance', 'done')),
  deadline date,
  budget numeric,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Restaurant : journal des pertes (utilise inventory_items pour les
-- ingrédients déjà en place) — donne un vrai coût matière/pertes au lieu
-- d'un stock générique sans suivi.
create table if not exists public.waste_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'unité',
  reason text not null default '',
  estimated_cost numeric,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;
alter table public.repair_orders enable row level security;
alter table public.contracts enable row level security;
alter table public.projects enable row level security;
alter table public.waste_log enable row level security;

drop policy if exists "vehicles: members all" on public.vehicles;
create policy "vehicles: members all" on public.vehicles
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "repair_orders: members all" on public.repair_orders;
create policy "repair_orders: members all" on public.repair_orders
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "contracts: members all" on public.contracts;
create policy "contracts: members all" on public.contracts
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "projects: members all" on public.projects;
create policy "projects: members all" on public.projects
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "waste_log: members all" on public.waste_log;
create policy "waste_log: members all" on public.waste_log
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists vehicles_workspace_idx on public.vehicles(workspace_id);
create index if not exists repair_orders_workspace_idx on public.repair_orders(workspace_id, status);
create index if not exists repair_orders_vehicle_idx on public.repair_orders(vehicle_id);
create index if not exists contracts_workspace_idx on public.contracts(workspace_id, status);
create index if not exists projects_workspace_idx on public.projects(workspace_id, status);
create index if not exists waste_log_workspace_idx on public.waste_log(workspace_id, logged_at);

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
drop trigger if exists repair_orders_set_updated_at on public.repair_orders;
create trigger repair_orders_set_updated_at before update on public.repair_orders
  for each row execute function public.set_updated_at();
drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
