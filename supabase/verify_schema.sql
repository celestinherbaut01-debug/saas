-- À coller dans Supabase SQL Editor. Lecture seule. N'affiche QUE ce qui
-- manque réellement (le diff est fait par la base, pas à compter à la main).

with expected(kind, name) as (
  values
    ('table','profiles'), ('table','workspaces'), ('table','workspace_members'),
    ('table','business_profiles'), ('table','business_categories'),
    ('table','workspace_targets'), ('table','search_zones'), ('table','prospects'),
    ('table','verification_cache'), ('table','activities'), ('table','subscriptions'),
    ('table','customers'), ('table','inventory_items'), ('table','appointments'),
    ('table','usage_counters'), ('table','xp_events'),
    ('function','handle_new_user'), ('function','handle_new_workspace'),
    ('function','is_workspace_member'), ('function','set_updated_at'),
    ('function','increment_usage'), ('function','award_xp'), ('function','complete_onboarding')
),
present as (
  select 'table' as kind, table_name as name
  from information_schema.tables
  where table_schema = 'public'
  union all
  select 'function' as kind, routine_name as name
  from information_schema.routines
  where routine_schema = 'public'
)
select e.kind, e.name as missing
from expected e
left join present p on p.kind = e.kind and p.name = e.name
where p.name is null
order by e.kind, e.name;
