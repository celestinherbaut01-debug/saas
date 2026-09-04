-- Business OS Garage — passe de "3 modules relabellés" (0006/0016) à une
-- vraie application métier : équipe, fournisseurs, catalogue de pièces avec
-- coût/prix, lignes de pièces par ordre de réparation, devis/factures réels,
-- et le vrai workflow en 7 étapes d'un garage (au lieu des 5 étapes
-- génériques posées dans 0016).
--
-- Conçu pour être réutilisé tel quel par les autres verticales (Agence,
-- Nettoyage, Restaurant) : team_members/suppliers/documents ne sont PAS
-- spécifiques au garage, seuls parts/repair_order_parts le sont.

-- 1) Équipe : techniciens (garage), employés (nettoyage), équipe (agence/restaurant).
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  role text not null default '',
  phone text,
  email text,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Fournisseurs : pièces (garage), consommables (nettoyage), ingrédients (restaurant).
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Catalogue de pièces (garage) : référence + coût d'achat + prix de vente
-- + niveau de stock — remplace inventory_items pour ce métier, qui n'avait
-- ni coût, ni prix, ni référence, ni fournisseur.
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  reference text not null default '',
  unit_cost numeric not null default 0,
  unit_price numeric not null default 0,
  quantity numeric not null default 0,
  unit text not null default 'unité',
  low_stock_threshold numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Lignes de pièces utilisées sur un ordre de réparation — coût/prix figés
-- au moment de l'ajout (le prix catalogue peut changer ensuite sans fausser
-- l'historique des ordres déjà facturés).
create table if not exists public.repair_order_parts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  part_id uuid references public.parts(id) on delete set null,
  part_name text not null,
  quantity numeric not null default 1,
  unit_cost numeric not null default 0,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 5) Devis / Factures — table générique réutilisée par Garage (liée à un
-- ordre de réparation), et plus tard Agence (projet) / Nettoyage (contrat).
-- Un seul des trois FK est renseigné selon la verticale d'origine.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  doc_type text not null check (doc_type in ('quote', 'invoice')),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'refused', 'paid', 'overdue', 'canceled')),
  customer_id uuid references public.customers(id) on delete set null,
  repair_order_id uuid references public.repair_orders(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  number text not null default '',
  total_ht numeric not null default 0,
  total_ttc numeric not null default 0,
  issued_at date not null default current_date,
  due_at date,
  paid_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) Workflow réel d'un garage : À diagnostiquer → Devis → Accepté → En
-- réparation → En attente pièce → Terminé → Livré (0016 n'avait que 5 états
-- génériques sans devis/livraison). 'invoiced' n'existe plus comme statut :
-- la facturation est désormais un vrai document (documents), pas un statut.
update public.repair_orders set status = 'done' where status = 'invoiced';
alter table public.repair_orders drop constraint if exists repair_orders_status_check;
alter table public.repair_orders add constraint repair_orders_status_check
  check (status in ('diagnostic', 'quote', 'accepted', 'in_progress', 'waiting_parts', 'done', 'delivered'));

alter table public.repair_orders add column if not exists technician_id uuid references public.team_members(id) on delete set null;
alter table public.repair_orders add column if not exists delivered_at timestamptz;

alter table public.team_members enable row level security;
alter table public.suppliers enable row level security;
alter table public.parts enable row level security;
alter table public.repair_order_parts enable row level security;
alter table public.documents enable row level security;

drop policy if exists "team_members: members all" on public.team_members;
create policy "team_members: members all" on public.team_members
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "suppliers: members all" on public.suppliers;
create policy "suppliers: members all" on public.suppliers
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "parts: members all" on public.parts;
create policy "parts: members all" on public.parts
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "repair_order_parts: members all" on public.repair_order_parts;
create policy "repair_order_parts: members all" on public.repair_order_parts
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "documents: members all" on public.documents;
create policy "documents: members all" on public.documents
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists team_members_workspace_idx on public.team_members(workspace_id);
create index if not exists suppliers_workspace_idx on public.suppliers(workspace_id);
create index if not exists parts_workspace_idx on public.parts(workspace_id);
create index if not exists repair_order_parts_order_idx on public.repair_order_parts(repair_order_id);
create index if not exists documents_workspace_idx on public.documents(workspace_id, doc_type, status);
create index if not exists documents_repair_order_idx on public.documents(repair_order_id);
create index if not exists repair_orders_technician_idx on public.repair_orders(technician_id);

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();
drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();
drop trigger if exists parts_set_updated_at on public.parts;
create trigger parts_set_updated_at before update on public.parts
  for each row execute function public.set_updated_at();
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
