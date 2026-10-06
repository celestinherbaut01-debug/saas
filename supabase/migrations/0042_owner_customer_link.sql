-- Reuse a CRM-converted client in an owner record without re-entering contact details.
alter table public.customers add constraint customers_workspace_id_id_unique unique(workspace_id,id);
alter table public.property_owners add column customer_id uuid;
alter table public.property_owners add constraint owner_customer_workspace_fk foreign key(workspace_id,customer_id) references public.customers(workspace_id,id);
create unique index owner_customer_unique on public.property_owners(workspace_id,customer_id) where customer_id is not null;
