-- Réparation défensive de 0037/0041 (et vérification de 0042) : ces deux
-- fichiers sont les SEULS de tout l'historique (0001-0042) à utiliser des
-- blocs begin/commit explicites. Le reste du projet s'appuie sur le fait
-- que l'outil d'application de migrations (ex. `supabase db push`) ouvre
-- déjà sa propre transaction par fichier — un `commit;` au milieu d'un
-- fichier termine prématurément CETTE transaction-là, ce qui peut laisser
-- les tables/contraintes des lignes suivantes du même fichier dans un état
-- incomplet selon l'outil utilisé pour appliquer la migration. Résultat
-- observé : les requêtes sur `properties`/`property_mandates` échouent
-- (table/colonne absente), ce que l'application classe honnêtement comme
-- "schéma manquant" — alors que 0037 a été listée comme appliquée.
--
-- Cette migration ne modifie ni ne réapplique 0037/0041/0042 : elle amène
-- l'état final à ce qu'ils étaient censés produire, que ces fichiers aient
-- partiellement, totalement ou pas du tout réussi — entièrement idempotente
-- (aucune erreur si tout existe déjà), sans begin/commit explicite (même
-- convention que le reste du projet).

create table if not exists public.property_owners (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check(length(trim(name))>0), email text, phone text, notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid, title text not null check(length(trim(title))>0), property_type text, address text, city text,
  surface_m2 numeric check(surface_m2>=0), rooms integer check(rooms>=0), bedrooms integer check(bedrooms>=0),
  price numeric check(price>=0), description text not null default '', features text[] not null default '{}',
  status text not null default 'new' check(status in ('new','mandate','to_publish','published','visits','offer','accepted','closed')),
  transaction_type text not null default 'sale' check(transaction_type in ('sale','rent')), dpe text check(dpe in ('A','B','C','D','E','F','G')),
  photos jsonb not null default '[]' check(jsonb_typeof(photos)='array'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,owner_id) references public.property_owners(workspace_id,id)
);
create table if not exists public.property_mandates (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null, owner_id uuid not null,
  mandate_type text not null check(mandate_type in ('simple','exclusive')), starts_on date not null,
  expires_on date check(expires_on>=starts_on), status text not null default 'active' check(status in ('active','expired','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,property_id) references public.properties(workspace_id,id),
  foreign key(workspace_id,owner_id) references public.property_owners(workspace_id,id)
);
create table if not exists public.property_buyers (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check(length(trim(name))>0), email text, phone text, criteria text not null default '', budget numeric check(budget>=0),
  interested_property_ids uuid[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table if not exists public.property_visits (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null, buyer_id uuid not null, starts_at timestamptz not null,
  status text not null default 'planned' check(status in ('planned','completed','canceled')), report text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,property_id) references public.properties(workspace_id,id),
  foreign key(workspace_id,buyer_id) references public.property_buyers(workspace_id,id)
);
create table if not exists public.property_offers (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null, buyer_id uuid not null, amount numeric not null check(amount>0),
  status text not null default 'pending' check(status in ('pending','accepted','rejected')), notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
  foreign key(workspace_id,property_id) references public.properties(workspace_id,id),
  foreign key(workspace_id,buyer_id) references public.property_buyers(workspace_id,id)
);

do $$ declare t text; begin
  foreach t in array array['property_owners','properties','property_mandates','property_buyers','property_visits','property_offers'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='workspace members') then
      execute format('create policy "workspace members" on public.%I for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))', t);
    end if;
    if not exists (select 1 from pg_indexes where schemaname='public' and tablename=t and indexname=t||'_workspace_id_idx') then
      execute format('create index %I on public.%I(workspace_id)', t||'_workspace_id_idx', t);
    end if;
    if not exists (select 1 from pg_trigger where tgname='set_updated_at_'||t) then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_updated_at_'||t, t);
    end if;
  end loop;
end $$;

alter table public.studio_creations add column if not exists source_property_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'studio_property_workspace_fk') then
    alter table public.studio_creations add constraint studio_property_workspace_fk foreign key(workspace_id,source_property_id) references public.properties(workspace_id,id);
  end if;
end $$;
create index if not exists studio_creations_workspace_property_idx on public.studio_creations(workspace_id,source_property_id);

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'business_twin_snapshots_vertical_check') then
    alter table public.business_twin_snapshots drop constraint business_twin_snapshots_vertical_check;
  end if;
  alter table public.business_twin_snapshots add constraint business_twin_snapshots_vertical_check check(vertical in ('garage','cleaning','agency','restaurant','realestate','generic'));
end $$;

-- 0041 : fonctions déjà idempotentes (create or replace) ; seuls les
-- triggers ont besoin d'un drop/create défensif.
create or replace function public.validate_estate_relations() returns trigger
language plpgsql security invoker set search_path=public as $$
declare linked_owner uuid; pid uuid;
begin
  if tg_table_name='property_mandates' then
    select owner_id into linked_owner from public.properties where id=new.property_id and workspace_id=new.workspace_id;
    if linked_owner is distinct from new.owner_id then raise exception 'Le mandat doit être lié au propriétaire du bien'; end if;
  elsif tg_table_name='property_buyers' then
    foreach pid in array new.interested_property_ids loop
      if not exists(select 1 from public.properties where id=pid and workspace_id=new.workspace_id) then raise exception 'Bien intéressé inaccessible'; end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists validate_mandate_owner on public.property_mandates;
create trigger validate_mandate_owner before insert or update on public.property_mandates for each row execute function public.validate_estate_relations();
drop trigger if exists validate_buyer_properties on public.property_buyers;
create trigger validate_buyer_properties before insert or update on public.property_buyers for each row execute function public.validate_estate_relations();

create or replace function public.advance_estate_workflow() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if tg_table_name='property_mandates' and new.status='active' then
    update public.properties set status='mandate' where workspace_id=new.workspace_id and id=new.property_id and status='new';
  elsif tg_table_name='property_visits' and new.status in ('planned','completed') then
    update public.properties set status='visits' where workspace_id=new.workspace_id and id=new.property_id and status in ('published','to_publish');
  elsif tg_table_name='property_offers' then
    if new.status='accepted' then
      update public.properties set status='accepted' where workspace_id=new.workspace_id and id=new.property_id and status<>'closed';
    elsif new.status='pending' then
      update public.properties set status='offer' where workspace_id=new.workspace_id and id=new.property_id and status not in ('accepted','closed');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mandate_workflow on public.property_mandates;
create trigger mandate_workflow after insert or update on public.property_mandates for each row execute function public.advance_estate_workflow();
drop trigger if exists visit_workflow on public.property_visits;
create trigger visit_workflow after insert or update on public.property_visits for each row execute function public.advance_estate_workflow();
drop trigger if exists offer_workflow on public.property_offers;
create trigger offer_workflow after insert or update on public.property_offers for each row execute function public.advance_estate_workflow();

-- 0042 : vérifié par la même occasion (fichier sans begin/commit, donc a
-- priori sain, mais dépendait de property_owners qui pouvait être affectée).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customers_workspace_id_id_unique') then
    alter table public.customers add constraint customers_workspace_id_id_unique unique(workspace_id,id);
  end if;
end $$;
alter table public.property_owners add column if not exists customer_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'owner_customer_workspace_fk') then
    alter table public.property_owners add constraint owner_customer_workspace_fk foreign key(workspace_id,customer_id) references public.customers(workspace_id,id);
  end if;
end $$;
create unique index if not exists owner_customer_unique on public.property_owners(workspace_id,customer_id) where customer_id is not null;
