-- Business OS (plan Max) : modules réutilisables plutôt que des dizaines
-- d'applications métier séparées. Le libellé affiché change selon le métier
-- du workspace (ex. "Pièces" pour un garage, "Produits" pour un salon), mais
-- la table et le code sont les mêmes.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'unité',
  low_stock_threshold numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "customers: members all" on public.customers;
create policy "customers: members all" on public.customers
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "inventory_items: members all" on public.inventory_items;
create policy "inventory_items: members all" on public.inventory_items
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "appointments: members all" on public.appointments;
create policy "appointments: members all" on public.appointments
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists customers_workspace_idx on public.customers(workspace_id);
create index if not exists inventory_items_workspace_idx on public.inventory_items(workspace_id);
create index if not exists appointments_workspace_idx on public.appointments(workspace_id, starts_at);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
