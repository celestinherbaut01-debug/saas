begin;
create table public.property_owners (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check(length(trim(name))>0), email text, phone text, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.properties (
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
create table public.property_mandates (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 property_id uuid not null, owner_id uuid not null,
 mandate_type text not null check(mandate_type in ('simple','exclusive')), starts_on date not null,
 expires_on date check(expires_on>=starts_on), status text not null default 'active' check(status in ('active','expired','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,property_id) references public.properties(workspace_id,id),
 foreign key(workspace_id,owner_id) references public.property_owners(workspace_id,id)
);
create table public.property_buyers (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check(length(trim(name))>0), email text, phone text, criteria text not null default '', budget numeric check(budget>=0),
 interested_property_ids uuid[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.property_visits (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 property_id uuid not null, buyer_id uuid not null, starts_at timestamptz not null,
 status text not null default 'planned' check(status in ('planned','completed','canceled')), report text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,property_id) references public.properties(workspace_id,id),
 foreign key(workspace_id,buyer_id) references public.property_buyers(workspace_id,id)
);
create table public.property_offers (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 property_id uuid not null, buyer_id uuid not null, amount numeric not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')), notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,property_id) references public.properties(workspace_id,id),
 foreign key(workspace_id,buyer_id) references public.property_buyers(workspace_id,id)
);
do $$ declare t text; begin
 foreach t in array array['property_owners','properties','property_mandates','property_buyers','property_visits','property_offers'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy "workspace members" on public.%I for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',t);
  execute format('create index on public.%I(workspace_id)',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;
alter table public.studio_creations add column source_property_id uuid;
alter table public.studio_creations add constraint studio_property_workspace_fk foreign key(workspace_id,source_property_id) references public.properties(workspace_id,id);
create index on public.studio_creations(workspace_id,source_property_id);
commit;
alter table public.business_twin_snapshots drop constraint business_twin_snapshots_vertical_check;
alter table public.business_twin_snapshots add constraint business_twin_snapshots_vertical_check check(vertical in ('garage','cleaning','agency','restaurant','realestate','generic'));
