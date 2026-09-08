-- Actions CRUD manquantes dans Business OS : "on peut créer un client mais
-- aucun moyen de le supprimer" — en réalité la suppression existait déjà
-- (bouton "Supprimer" dans chaque tiroir), mais sans confirmation ET en
-- suppression définitive directe, y compris pour des lignes avec des
-- données liées (un client avec des véhicules/ordres de réparation, un
-- ordre de réparation avec un devis/une facture...).
--
-- `archived_at` donne une alternative non destructive : la ligne disparaît
-- des listes actives (toutes les requêtes de listing filtrent désormais
-- `archived_at is null`) sans rien supprimer ni casser les enregistrements
-- qui la référencent encore.
--
-- Limité aux tables où l'archivage a un sens produit réel (des lignes que
-- l'on crée pour durer et consulter l'historique). Les lignes techniques
-- (repair_order_parts, purchase_order_items, recipe_ingredients, tasks,
-- tickets, interventions, incidents...) restent en suppression directe
-- confirmée uniquement — ce sont des lignes de détail, pas des fiches.
alter table public.customers add column if not exists archived_at timestamptz;
alter table public.vehicles add column if not exists archived_at timestamptz;
alter table public.repair_orders add column if not exists archived_at timestamptz;
alter table public.contracts add column if not exists archived_at timestamptz;
alter table public.projects add column if not exists archived_at timestamptz;
alter table public.sites add column if not exists archived_at timestamptz;
alter table public.client_sites add column if not exists archived_at timestamptz;
alter table public.suppliers add column if not exists archived_at timestamptz;
alter table public.parts add column if not exists archived_at timestamptz;
alter table public.inventory_items add column if not exists archived_at timestamptz;
alter table public.team_members add column if not exists archived_at timestamptz;

create index if not exists customers_active_idx on public.customers(workspace_id) where archived_at is null;
create index if not exists vehicles_active_idx on public.vehicles(workspace_id) where archived_at is null;
create index if not exists repair_orders_active_idx on public.repair_orders(workspace_id) where archived_at is null;
create index if not exists contracts_active_idx on public.contracts(workspace_id) where archived_at is null;
create index if not exists projects_active_idx on public.projects(workspace_id) where archived_at is null;
create index if not exists sites_active_idx on public.sites(workspace_id) where archived_at is null;
create index if not exists client_sites_active_idx on public.client_sites(workspace_id) where archived_at is null;
create index if not exists suppliers_active_idx on public.suppliers(workspace_id) where archived_at is null;
create index if not exists parts_active_idx on public.parts(workspace_id) where archived_at is null;
create index if not exists inventory_items_active_idx on public.inventory_items(workspace_id) where archived_at is null;
create index if not exists team_members_active_idx on public.team_members(workspace_id) where archived_at is null;
