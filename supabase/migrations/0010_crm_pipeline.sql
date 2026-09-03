-- Pipeline CRM complet (section 14 du cahier des charges) : le pipeline
-- initial (new/to_contact/contacted/replied/won/lost) manquait des étapes
-- intermédiaires réelles (intéressé, RDV, devis) et un statut de conformité
-- explicite "ne plus contacter" (nécessaire avant tout envoi d'email futur).
-- Toutes les lignes existantes gardent leur statut actuel : ces valeurs
-- restent valides, on ne fait qu'ÉLARGIR la contrainte.

alter table public.prospects drop constraint if exists prospects_status_check;
alter table public.prospects add constraint prospects_status_check check (status in (
  'new', 'to_contact', 'contacted', 'replied', 'interested', 'rdv', 'quote', 'won', 'lost', 'do_not_contact'
));

-- Le trigger XP (0008) ne connaissait que contacted/replied/won. On ajoute
-- 'rdv' (obtenir un rendez-vous mérite de l'XP, comme un client gagné en
-- plus petit) sans changer les montants déjà attribués.
create or replace function public.trg_award_xp_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'contacted' then
      perform public.award_xp(new.workspace_id, 'status_contacted', 10, new.id, true);
    elsif new.status = 'replied' then
      perform public.award_xp(new.workspace_id, 'status_replied', 20, new.id, true);
    elsif new.status = 'rdv' then
      perform public.award_xp(new.workspace_id, 'status_rdv', 30, new.id, true);
    elsif new.status = 'won' then
      perform public.award_xp(new.workspace_id, 'status_won', 100, new.id, true);
    end if;
  end if;
  return new;
end;
$$;
