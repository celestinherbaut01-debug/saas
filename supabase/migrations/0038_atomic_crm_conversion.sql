-- Transaction + row lock: retries and concurrent tabs cannot create duplicates.
create or replace function public.convert_won_prospect(p_prospect_id uuid) returns uuid
language plpgsql security invoker set search_path=public as $$
declare p public.prospects; customer_id uuid;
begin
 select * into p from public.prospects where id=p_prospect_id for update;
 if not found or not public.is_workspace_member(p.workspace_id) then raise exception 'Prospect inaccessible' using errcode='42501'; end if;
 if p.status <> 'won' then raise exception 'Le prospect doit être gagné'; end if;
 if p.converted_customer_id is not null then return p.converted_customer_id; end if;
 insert into public.customers(workspace_id,name,phone,notes)
 values(p.workspace_id,p.company_name,p.phone,'Converti depuis le CRM') returning id into customer_id;
 update public.prospects set converted_customer_id=customer_id where id=p.id;
 return customer_id;
end $$;
revoke all on function public.convert_won_prospect(uuid) from public;
grant execute on function public.convert_won_prospect(uuid) to authenticated;
