-- Persistance complète de la configuration Prospection (spec produit :
-- "je remplis mon offre/mes catégories/ma zone, je change de page, je
-- reviens, tout a disparu — ce n'est pas acceptable").
--
-- Architecture retenue : PAS de nouvelle table qui dupliquerait des
-- colonnes déjà réelles ailleurs — offer_description/audience/adresse/
-- rayon vivent déjà dans business_profiles (une ligne par workspace),
-- et les métiers ciblés vivent déjà dans workspace_targets. La seule
-- pièce manquante est la configuration des FILTRES de recherche
-- (opérationnel uniquement, exclure chaînes, besoin digital...), qui
-- n'avait jusqu'ici aucun stockage et retombait à des valeurs par défaut
-- codées en dur à chaque montage du composant React.
alter table public.business_profiles
  add column if not exists search_filters jsonb not null default '{}'::jsonb;

comment on column public.business_profiles.search_filters is
  'Préférences de filtres Prospection (operationalOnly, excludeChains, webFilter...) — voir lib/prospecting-config.ts pour la forme normalisée et les valeurs par défaut. jsonb volontairement permissif : la normalisation/validation se fait côté application (jamais fait confiance à ce qui est lu ici sans passer par normalizeProspectionFilters()).';
