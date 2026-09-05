-- Refonte produit : ProspectFlow devient UNE plateforme avec DEUX modules
-- indépendants (Acquisition / Business OS), activables séparément. Cette
-- colonne est une PRÉFÉRENCE UTILISATEUR (pilote la navigation/l'accueil),
-- pas encore un droit facturé — l'architecture de facturation modulaire
-- (add-ons, bundle) est une étape distincte et ultérieure. Par défaut
-- 'both' : aucun compte existant ne perd l'accès à quoi que ce soit tant
-- qu'il n'a pas explicitement choisi un mode dans l'onboarding/Paramètres.
alter table public.business_profiles
  add column if not exists product_mode text not null default 'both'
    check (product_mode in ('acquisition', 'business_os', 'both'));
