begin;
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
create trigger validate_mandate_owner before insert or update on public.property_mandates for each row execute function public.validate_estate_relations();
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
create trigger mandate_workflow after insert or update on public.property_mandates for each row execute function public.advance_estate_workflow();
create trigger visit_workflow after insert or update on public.property_visits for each row execute function public.advance_estate_workflow();
create trigger offer_workflow after insert or update on public.property_offers for each row execute function public.advance_estate_workflow();
commit;
