-- À coller dans Supabase SQL Editor pour vérifier ce qui existe réellement
-- avant de rejouer des migrations. Ne modifie rien (lecture seule).

select 'table' as kind, table_name as name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','workspaces','workspace_members','business_profiles',
    'business_categories','workspace_targets','search_zones','prospects',
    'verification_cache','activities','subscriptions','customers',
    'inventory_items','appointments','usage_counters','xp_events'
  )
union all
select 'function' as kind, routine_name as name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'handle_new_user','handle_new_workspace','is_workspace_member',
    'set_updated_at','increment_usage','award_xp','complete_onboarding'
  )
order by kind, name;

-- 16 tables + 7 fonctions attendues = 23 lignes au total si tout est à jour
-- (0001 à 0010). Toute ligne manquante indique la migration à rejouer.
