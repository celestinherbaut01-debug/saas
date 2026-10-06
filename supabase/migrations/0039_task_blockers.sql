alter table public.tasks add column if not exists blocked boolean not null default false;
