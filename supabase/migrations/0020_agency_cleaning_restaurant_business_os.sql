-- Étend Nettoyage / Agence / Restaurant avec la même architecture que le
-- Garage (0019) : tables réelles réutilisant team_members/suppliers/
-- documents/parts déjà posés, plutôt que 3 modules génériques relabellés.
--
-- Consolidations volontaires (documentées ici, pas cachées) : certains
-- éléments demandés séparément partagent une seule table quand ils
-- décrivent le même objet réel avec des états différents — ex. Commandes +
-- Réceptions = un même bon de commande qui change de statut, pas deux
-- entités indépendantes.

-- === AGENCE ===
-- "Sites" + "Domaines" + "Hébergements" + "Renouvellements" + "Maintenance"
-- décrivent tous le même objet réel (un site web géré pour un client) sous
-- des angles différents : consolidés en une seule table avec les dates qui
-- comptent, plutôt que 5 tables couplées entre elles par des FK.
create table if not exists public.client_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  domain_name text not null default '',
  hosting_provider text not null default '',
  domain_renewal_date date,
  hosting_renewal_date date,
  next_maintenance_at date,
  monthly_price numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  site_id uuid references public.client_sites(id) on delete set null,
  title text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === NETTOYAGE ===
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contracts add column if not exists site_id uuid references public.sites(id) on delete set null;

-- "Interventions" + "Planning" (nettoyage) + "Qualité" partagent la même
-- donnée réelle : une intervention planifiée, réalisée par une équipe, avec
-- une note qualité optionnelle a posteriori.
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'done', 'missed')),
  quality_rating integer check (quality_rating between 1 and 5),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  title text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  notes text not null default '',
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === RESTAURANT ===
-- Coût d'achat par ingrédient — nécessaire pour calculer un vrai food cost
-- (coût matière réel / prix de vente), absent jusqu'ici (inventory_items
-- n'avait ni coût, ni fournisseur).
alter table public.inventory_items add column if not exists unit_cost numeric not null default 0;
alter table public.inventory_items add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- "Commandes" + "Réceptions" = un même bon de commande fournisseur qui
-- change de statut (commandé -> reçu), pas deux tables couplées.
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'canceled')),
  total_cost numeric not null default 0,
  ordered_at date,
  received_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric not null default 1,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  selling_price numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric not null default 1,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.client_sites enable row level security;
alter table public.tickets enable row level security;
alter table public.tasks enable row level security;
alter table public.sites enable row level security;
alter table public.interventions enable row level security;
alter table public.incidents enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

drop policy if exists "client_sites: members all" on public.client_sites;
create policy "client_sites: members all" on public.client_sites
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "tickets: members all" on public.tickets;
create policy "tickets: members all" on public.tickets
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "tasks: members all" on public.tasks;
create policy "tasks: members all" on public.tasks
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "sites: members all" on public.sites;
create policy "sites: members all" on public.sites
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "interventions: members all" on public.interventions;
create policy "interventions: members all" on public.interventions
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "incidents: members all" on public.incidents;
create policy "incidents: members all" on public.incidents
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "purchase_orders: members all" on public.purchase_orders;
create policy "purchase_orders: members all" on public.purchase_orders
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "purchase_order_items: members all" on public.purchase_order_items;
create policy "purchase_order_items: members all" on public.purchase_order_items
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "recipes: members all" on public.recipes;
create policy "recipes: members all" on public.recipes
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "recipe_ingredients: members all" on public.recipe_ingredients;
create policy "recipe_ingredients: members all" on public.recipe_ingredients
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists client_sites_workspace_idx on public.client_sites(workspace_id);
create index if not exists tickets_workspace_idx on public.tickets(workspace_id, status);
create index if not exists tasks_workspace_idx on public.tasks(workspace_id, done);
create index if not exists sites_workspace_idx on public.sites(workspace_id);
create index if not exists interventions_workspace_idx on public.interventions(workspace_id, scheduled_at);
create index if not exists incidents_workspace_idx on public.incidents(workspace_id, status);
create index if not exists purchase_orders_workspace_idx on public.purchase_orders(workspace_id, status);
create index if not exists purchase_order_items_order_idx on public.purchase_order_items(purchase_order_id);
create index if not exists recipes_workspace_idx on public.recipes(workspace_id);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id);

drop trigger if exists client_sites_set_updated_at on public.client_sites;
create trigger client_sites_set_updated_at before update on public.client_sites
  for each row execute function public.set_updated_at();
drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at before update on public.sites
  for each row execute function public.set_updated_at();
drop trigger if exists interventions_set_updated_at on public.interventions;
create trigger interventions_set_updated_at before update on public.interventions
  for each row execute function public.set_updated_at();
drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at before update on public.incidents
  for each row execute function public.set_updated_at();
drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();
drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
