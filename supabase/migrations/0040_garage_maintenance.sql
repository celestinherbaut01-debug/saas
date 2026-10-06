-- A reminder is scheduled by the garage; no arbitrary maintenance interval is invented.
alter table public.vehicles add column if not exists next_maintenance_on date;
