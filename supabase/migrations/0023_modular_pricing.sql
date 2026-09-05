-- Refonte produit : ProspectFlow devient une plateforme à DEUX modules
-- indépendants (Acquisition / Business OS) au lieu d'un seul axe linéaire
-- (free/starter/pro/max) où "pro" forçait Business OS standard même pour un
-- client qui ne voulait qu'Acquisition — exactement le problème signalé
-- ("un garagiste ne va pas payer 249€ pour utiliser 30% du produit").
--
-- Migration des abonnements EXISTANTS vers le nouveau catalogue, avec des
-- droits ÉQUIVALENTS (jamais moins) à ce qu'ils avaient déjà :
--   starter -> acquisition_starter (mêmes limites, aucun Business OS avant)
--   pro     -> complete            (avait déjà Acquisition + Business OS standard)
--   max     -> complete_max        (avait déjà Acquisition + Business OS avancé)
--   free    -> free (inchangé)
-- Les nouveaux plans autonomes (acquisition_pro, business_os,
-- business_os_advanced) deviennent disponibles comme CHOIX pour les
-- nouveaux clients ou ceux qui veulent changer — personne n'est migré vers
-- eux automatiquement puisqu'ils correspondent à MOINS que ce qu'un
-- ancien "pro"/"max" avait déjà payé.

update public.subscriptions set plan = 'acquisition_starter' where plan = 'starter';
update public.subscriptions set plan = 'complete' where plan = 'pro';
update public.subscriptions set plan = 'complete_max' where plan = 'max';

update public.workspaces set plan = 'acquisition_starter' where plan = 'starter';
update public.workspaces set plan = 'complete' where plan = 'pro';
update public.workspaces set plan = 'complete_max' where plan = 'max';

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free', 'acquisition_starter', 'acquisition_pro', 'business_os', 'business_os_advanced', 'complete', 'complete_max'));

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces add constraint workspaces_plan_check
  check (plan in ('free', 'acquisition_starter', 'acquisition_pro', 'business_os', 'business_os_advanced', 'complete', 'complete_max'));

-- Les nouveaux workspaces démarraient sur 'starter' (renommé) par défaut.
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (workspace_id, plan)
  values (new.id, 'acquisition_starter')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;
