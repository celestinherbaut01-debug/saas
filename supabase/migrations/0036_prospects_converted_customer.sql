-- Relie un prospect gagné au client Business OS créé pour lui, pour ne
-- jamais dupliquer la création d'un client si le statut "Gagné" est modifié
-- plusieurs fois (CRM Kanban ou fiche prospect), et pour pouvoir confirmer
-- à l'utilisateur que la conversion a bien eu lieu.
alter table public.prospects
  add column if not exists converted_customer_id uuid references public.customers(id) on delete set null;
