-- Capacités "commerce/stock" génériques et réutilisables — pas des tables
-- spécifiques à la boucherie. Conçu pour que le prochain métier qui a
-- besoin de catégories de produits, de coût/prix, de fournisseur, de
-- mouvements de stock (réceptions/pertes/ajustements) ou de commandes
-- fournisseurs les réutilise directement, comme `suppliers` (0019) est déjà
-- partagé par garage/nettoyage/restaurant. Le métier Boucherie (catégorie
-- "butcher") est le premier à les utiliser réellement (voir business-os.ts).

-- 1) Catégories de produits — génériques, pas propres à un métier.
create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.inventory_categories enable row level security;
drop policy if exists "inventory_categories: members all" on public.inventory_categories;
create policy "inventory_categories: members all" on public.inventory_categories
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists inventory_categories_workspace_idx on public.inventory_categories(workspace_id);

-- 2) inventory_items (0006, déjà générique) étendu avec les colonnes
-- manquantes pour un vrai suivi commerçant. `supplier_id`/`unit_cost`/
-- `archived_at` existent déjà (0020, 0026) — non touchés ici, seules
-- `category_id`/`reference`/`unit_price` sont réellement nouvelles.
-- Aucune ligne existante (cleaning/restaurant/generic) n'est affectée.
alter table public.inventory_items add column if not exists category_id uuid references public.inventory_categories(id) on delete set null;
alter table public.inventory_items add column if not exists reference text not null default '';
alter table public.inventory_items add column if not exists unit_price numeric;

-- 3) Mouvements de stock — le vrai historique (réceptions, ventes, pertes,
-- ajustements), avec lot/DLC quand l'information est réellement saisie
-- (jamais déduite ni inventée). `quantity_delta` positif pour une entrée
-- (réception, ajustement +), négatif pour une sortie (vente, perte,
-- ajustement -). `reception_id` regroupe les lignes d'une même réception
-- (voir goods_receptions ci-dessous) — pas de table de lignes séparée,
-- les mouvements EN SONT les lignes.
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  type text not null check (type in ('reception', 'sale', 'loss', 'adjustment')),
  quantity_delta numeric not null check (quantity_delta <> 0),
  unit_cost numeric,
  lot_number text,
  expires_on date,
  reason text not null default '',
  reception_id uuid,
  created_at timestamptz not null default now()
);

alter table public.inventory_movements enable row level security;
drop policy if exists "inventory_movements: members all" on public.inventory_movements;
create policy "inventory_movements: members all" on public.inventory_movements
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists inventory_movements_workspace_idx on public.inventory_movements(workspace_id, created_at desc);
create index if not exists inventory_movements_item_idx on public.inventory_movements(item_id);
create index if not exists inventory_movements_reception_idx on public.inventory_movements(reception_id) where reception_id is not null;
create index if not exists inventory_movements_expires_idx on public.inventory_movements(workspace_id, expires_on) where expires_on is not null;

-- 4) Commandes fournisseurs — ce qui est DEMANDÉ, distinct de ce qui est
-- réellement arrivé (goods_receptions). Statut volontairement simple.
create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent', 'confirmed', 'received', 'canceled')),
  ordered_at date not null default current_date,
  expected_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_orders enable row level security;
drop policy if exists "supplier_orders: members all" on public.supplier_orders;
create policy "supplier_orders: members all" on public.supplier_orders
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists supplier_orders_workspace_idx on public.supplier_orders(workspace_id, status);

drop trigger if exists supplier_orders_set_updated_at on public.supplier_orders;
create trigger supplier_orders_set_updated_at
  before update on public.supplier_orders
  for each row execute function public.set_updated_at();

create table if not exists public.supplier_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null references public.supplier_orders(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric,
  created_at timestamptz not null default now()
);

alter table public.supplier_order_items enable row level security;
drop policy if exists "supplier_order_items: members all" on public.supplier_order_items;
create policy "supplier_order_items: members all" on public.supplier_order_items
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists supplier_order_items_order_idx on public.supplier_order_items(order_id);

-- 5) Réceptions de marchandises — document d'en-tête ; ses lignes sont les
-- inventory_movements (type='reception') dont reception_id pointe ici.
create table if not exists public.goods_receptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  order_id uuid references public.supplier_orders(id) on delete set null,
  received_at date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.goods_receptions enable row level security;
drop policy if exists "goods_receptions: members all" on public.goods_receptions;
create policy "goods_receptions: members all" on public.goods_receptions
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists goods_receptions_workspace_idx on public.goods_receptions(workspace_id, received_at desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_reception_fk') then
    alter table public.inventory_movements add constraint inventory_movements_reception_fk foreign key (reception_id) references public.goods_receptions(id) on delete set null;
  end if;
end $$;

-- 6) Le Business Twin (0031/0037) a une liste fermée de verticales pour
-- `business_twin_snapshots.vertical` — "butcher" doit y être ajouté pour
-- que le Boucherie OS puisse enregistrer un snapshot.
alter table public.business_twin_snapshots drop constraint if exists business_twin_snapshots_vertical_check;
alter table public.business_twin_snapshots add constraint business_twin_snapshots_vertical_check
  check (vertical in ('garage', 'cleaning', 'agency', 'restaurant', 'realestate', 'butcher', 'generic'));
