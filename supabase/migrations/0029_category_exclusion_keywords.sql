-- Précision de recherche par métier : "je veux éviter les correspondances
-- grossières" (ex. un grossiste de pièces auto remonté dans une recherche
-- de garages, une franchise à centre fermé remontée comme garage actif).
--
-- Volontairement PAS de colonne "google_place_type" : dans cette
-- architecture, Google Places sert à VÉRIFIER un établissement déjà trouvé
-- par le registre SIRENE (statut/site/téléphone), pas à DÉCOUVRIR des
-- établissements par type — une colonne stockée mais jamais lue par aucune
-- logique serait une donnée morte, le même problème que les badges de
-- confiance non branchés déjà corrigés ailleurs dans ce produit.
--
-- exclusion_keywords, lui, EST branché : le moteur de pertinence
-- (_shared/relevance.ts) rétrograde tout candidat dont le nom
-- d'établissement contient un des motifs d'exclusion de la catégorie
-- ciblée (ex. "grossiste" pour Garages automobiles), au lieu de le laisser
-- remonter en résultat "primary" comme n'importe quel autre garage.
alter table public.business_categories add column if not exists exclusion_keywords text[] not null default '{}';

update public.business_categories
set exclusion_keywords = array['grossiste','vente en gros','pieces detachees en gros','centre ferme','fermeture definitive']
where slug = 'garages' and array_length(exclusion_keywords, 1) is null;

update public.business_categories
set exclusion_keywords = array['grossiste','vente en gros']
where slug in ('bodyshop', 'tyres', 'autoparts') and array_length(exclusion_keywords, 1) is null;

update public.business_categories
set exclusion_keywords = array['grossiste','vente en gros','franchise fermee']
where slug = 'plumbing' and array_length(exclusion_keywords, 1) is null;

update public.business_categories
set exclusion_keywords = array['siege social','holding','franchise nationale']
where slug = 'cleaning' and array_length(exclusion_keywords, 1) is null;
