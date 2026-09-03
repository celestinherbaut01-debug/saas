-- À coller dans Supabase SQL Editor. Lecture seule, ne modifie rien.

-- 1) Résumé global — l'objectif est missing_profiles = 0.
select
  (select count(*) from auth.users) as total_auth_users,
  (select count(*) from public.profiles) as total_profiles,
  (select count(*) from auth.users u
     where not exists (select 1 from public.profiles p where p.id = u.id)) as missing_profiles,
  (select count(*) from public.profiles where onboarding_completed = true) as onboarding_done,
  (select count(*) from public.profiles where onboarding_completed = false) as onboarding_pending,
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where t.tgname = 'on_auth_user_created' and c.relname = 'users'
  ) as trigger_on_auth_user_created_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_completed'
  ) as column_onboarding_completed_exists;

-- 2) Détail ligne par ligne : chaque auth.users avec (si elle existe) sa
-- ligne profiles correspondante — pour repérer ton compte précisément.
select
  u.id as user_id,
  u.email,
  p.id as profile_id,
  p.full_name,
  p.avatar_url,
  p.onboarding_completed,
  (p.id is not null) as has_profile
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc
limit 50;
