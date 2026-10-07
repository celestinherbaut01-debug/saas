-- Lignes de devis/facture — jusqu'ici `documents` (0019) ne portait que des
-- totaux agrégés (total_ht/total_ttc), jamais de détail par ligne
-- (description/quantité/prix unitaire/TVA), et aucune interface ne
-- permettait de créer un devis/une facture manuellement : garage et
-- agence ne créaient un document que depuis un ordre de réparation / un
-- projet, montant forcé. Audit confirmé avant d'écrire cette migration.
--
-- Même pattern que repair_order_parts (0019) : workspace_id propre sur
-- chaque ligne pour une RLS directe (pas besoin de remonter via
-- document_id), pas de updated_at/trigger (les lignes d'un document sont
-- remplacées en bloc à la modification, jamais éditées une à une en place).
create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_ht numeric not null default 0 check (unit_price_ht >= 0),
  vat_rate numeric not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.document_items enable row level security;
drop policy if exists "document_items: members all" on public.document_items;
create policy "document_items: members all" on public.document_items
  for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists document_items_document_idx on public.document_items(document_id);
create index if not exists document_items_workspace_idx on public.document_items(workspace_id);

-- Lien devis -> facture convertie : "ne jamais dupliquer accidentellement
-- une facture si l'utilisateur clique deux fois" exige de savoir si CE
-- devis a déjà été converti, pour remplacer le bouton "Convertir" par un
-- lien "Convertie en facture FAC-..." plutôt que de reproposer l'action.
alter table public.documents add column if not exists converted_to_document_id uuid references public.documents(id) on delete set null;
create index if not exists documents_converted_to_idx on public.documents(converted_to_document_id) where converted_to_document_id is not null;
