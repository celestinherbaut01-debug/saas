-- CRM : relance et valeur commerciale (refonte Kanban) — deux colonnes
-- optionnelles, jamais calculées automatiquement : "prochaine relance" est
-- fixée manuellement par l'utilisateur depuis la fiche prospect, "valeur
-- commerciale" n'est affichée nulle part tant qu'elle n'a pas été saisie
-- (jamais une estimation inventée). Additive, aucune ligne existante
-- affectée.

alter table public.prospects
  add column if not exists next_followup_at timestamptz,
  add column if not exists deal_value numeric;
