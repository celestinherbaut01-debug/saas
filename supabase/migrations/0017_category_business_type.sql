-- Chaque métier du catalogue peut être B2B, B2C, ou les deux — utilisé par
-- les recommandations, le scoring et NOVA pour ne jamais suggérer, par
-- exemple, une administration comme cible B2C ou une famille comme cible
-- B2B pure. 'both' par défaut : ne bloque rien tant que la classification
-- réelle n'est pas encore faite pour une ligne donnée.

alter table public.business_categories
  add column if not exists business_type text not null default 'both'
    check (business_type in ('b2b', 'b2c', 'both'));

-- Classification des 98 métiers existants (0003_seed_categories.sql).
-- Jugement produit sur la clientèle TYPIQUE de chaque métier — pas une
-- donnée inventée sur une entreprise précise, une catégorisation du
-- catalogue lui-même, revue au cas par cas plutôt qu'une valeur par défaut
-- laissée partout à 'both'.

update public.business_categories set business_type = 'b2c' where slug in (
  'hotels','gites','campings','travel',
  'restaurants','fastfood','bars','catering',
  'bakery','butcher','fish','wine','cheese','organic',
  'supermarkets','convenience','clothing','shoes','furniture','florists','bookstores','jewelry','toys','decor','phone',
  'hair','beauty','spa','tattoo','barbers','nails',
  'gyms','sportsclubs',
  'medical','specialists','dentists','nurses','physio','osteo','pharmacy','opticians','vets',
  'motorcycle','drivingschool','carwash',
  'funeral','laundry','petgroom',
  'sophrology','naturopathy','hypnosis','digitopuncture','massage',
  'dance','yoga'
);

update public.business_categories set business_type = 'b2b' where slug in (
  'developers',
  'security','recruitment','accounting','law','consulting',
  'web','it','marketing','design',
  'transport','moving',
  'architects',
  'ambulance','labs'
);

-- Le reste (immobilier, garages, artisans BTP, événementiel, assurance,
-- photo, taxi, réparation, agences...) sert typiquement une clientèle
-- mixte (particuliers ET professionnels) : reste 'both', valeur par défaut.
