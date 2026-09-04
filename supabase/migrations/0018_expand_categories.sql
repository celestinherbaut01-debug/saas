-- Extension du catalogue de métiers (98 -> ~144). Chaque code NAF ci-dessous
-- vient de la nomenclature NAF Rev. 2 officielle telle que connue au moment
-- de la rédaction — cette session n'a PAS d'accès réseau pour revérifier
-- chaque code auprès de l'INSEE au moment de l'écrire. Volontairement
-- limité aux professions dont le code NAF est bien établi plutôt que de
-- viser un grand nombre de lignes avec des codes incertains : un mauvais
-- code NAF ferait remonter les mauvaises entreprises pour ce métier, ce qui
-- serait pire qu'un catalogue plus court mais fiable. À spot-checker avant
-- une mise en production commerciale à grande échelle (voir rapport final).

-- Nouvelle famille : Industrie (production, usinage, métallurgie, grossistes).
insert into public.business_categories (slug, name, sort_order) values
  ('industrie', 'Industrie & production', 16)
on conflict (slug) do nothing;

insert into public.business_categories (parent_id, slug, name, icon, naf_codes, keywords, business_type, sort_order) values
  -- Restauration
  ((select id from public.business_categories where slug = 'restauration' and parent_id is null), 'pizzeria', 'Pizzerias', '🍕', array['56.10A']::text[], array['pizzerias','pizza']::text[], 'b2c', 98),
  ((select id from public.business_categories where slug = 'restauration' and parent_id is null), 'pastry', 'Pâtisseries', '🍰', array['10.71C']::text[], array['patisseries','patissier']::text[], 'b2c', 99),
  ((select id from public.business_categories where slug = 'restauration' and parent_id is null), 'foodtruck', 'Food trucks', '🚐', array['56.10C']::text[], array['food truck','camion']::text[], 'b2c', 100),
  ((select id from public.business_categories where slug = 'restauration' and parent_id is null), 'icecream', 'Glaciers', '🍦', array['56.10B']::text[], array['glaciers','glace']::text[], 'b2c', 101),
  ((select id from public.business_categories where slug = 'restauration' and parent_id is null), 'teasalon', 'Salons de thé', '🍵', array['56.30Z']::text[], array['salon de the']::text[], 'b2c', 102),

  -- Commerce alimentaire
  ((select id from public.business_categories where slug = 'commerce-alimentaire' and parent_id is null), 'delicatessen', 'Épiceries fines', '🫒', array['47.29Z']::text[], array['epiceries fines']::text[], 'b2c', 103),
  ((select id from public.business_categories where slug = 'commerce-alimentaire' and parent_id is null), 'greengrocer', 'Primeurs', '🥕', array['47.21Z']::text[], array['primeurs','fruits et legumes']::text[], 'b2c', 104),

  -- Automobile
  ((select id from public.business_categories where slug = 'automobile' and parent_id is null), 'inspection', 'Contrôle technique', '✅', array['71.20A']::text[], array['controle technique']::text[], 'both', 105),
  ((select id from public.business_categories where slug = 'automobile' and parent_id is null), 'vanrental', 'Location de véhicules utilitaires', '🚐', array['77.12Z']::text[], array['location utilitaires']::text[], 'both', 106),
  ((select id from public.business_categories where slug = 'automobile' and parent_id is null), 'autoparts', 'Pièces détachées auto', '⚙️', array['45.32Z']::text[], array['pieces detachees auto']::text[], 'both', 107),

  -- BTP & artisans
  ((select id from public.business_categories where slug = 'btp-artisans' and parent_id is null), 'aircon', 'Climatisation', '❄️', array['43.22B']::text[], array['climatisation']::text[], 'b2c', 108),
  ((select id from public.business_categories where slug = 'btp-artisans' and parent_id is null), 'earthworks', 'Terrassement', '🚜', array['43.12A']::text[], array['terrassement']::text[], 'b2c', 109),
  ((select id from public.business_categories where slug = 'btp-artisans' and parent_id is null), 'framing', 'Charpente', '🪵', array['43.91A']::text[], array['charpente','charpentier']::text[], 'b2c', 110),
  ((select id from public.business_categories where slug = 'btp-artisans' and parent_id is null), 'plastering', 'Plâtrerie', '🧱', array['43.31Z']::text[], array['platrerie','platrier']::text[], 'b2c', 111),
  ((select id from public.business_categories where slug = 'btp-artisans' and parent_id is null), 'glazing', 'Vitrerie', '🪟', array['43.34Z']::text[], array['vitrerie','vitrier']::text[], 'b2c', 112),
  ((select id from public.business_categories where slug = 'btp-artisans' and parent_id is null), 'demolition', 'Démolition', '💥', array['43.11Z']::text[], array['demolition']::text[], 'b2b', 113),

  -- Santé
  ((select id from public.business_categories where slug = 'sante' and parent_id is null), 'orthodontics', 'Orthodontistes', '🦷', array['86.23Z']::text[], array['orthodontistes']::text[], 'b2c', 114),
  ((select id from public.business_categories where slug = 'sante' and parent_id is null), 'podiatry', 'Pédicures-podologues', '🦶', array['86.90F']::text[], array['pedicures','podologues']::text[], 'b2c', 115),
  ((select id from public.business_categories where slug = 'sante' and parent_id is null), 'dietitian', 'Diététiciens', '🥗', array['86.90F']::text[], array['dieteticiens']::text[], 'b2c', 116),
  ((select id from public.business_categories where slug = 'sante' and parent_id is null), 'psychology', 'Psychologues', '🧠', array['86.90F']::text[], array['psychologues']::text[], 'b2c', 117),

  -- Services B2B
  ((select id from public.business_categories where slug = 'services-b2b' and parent_id is null), 'notary', 'Notaires', '📜', array['69.10Z']::text[], array['notaires']::text[], 'b2b', 118),
  ((select id from public.business_categories where slug = 'services-b2b' and parent_id is null), 'bailiff', 'Commissaires de justice', '⚖️', array['69.10Z']::text[], array['huissiers','commissaires de justice']::text[], 'b2b', 119),
  ((select id from public.business_categories where slug = 'services-b2b' and parent_id is null), 'translation', 'Traducteurs & interprètes', '🌐', array['74.30Z']::text[], array['traducteurs','interpretes']::text[], 'b2b', 120),
  ((select id from public.business_categories where slug = 'services-b2b' and parent_id is null), 'staffing', 'Travail temporaire / intérim', '👥', array['78.20Z']::text[], array['interim','travail temporaire']::text[], 'b2b', 121),

  -- Numérique & communication
  ((select id from public.business_categories where slug = 'numerique-communication' and parent_id is null), 'video', 'Vidéastes & production', '🎬', array['59.11Z']::text[], array['videastes','production video']::text[], 'b2b', 122),
  ((select id from public.business_categories where slug = 'numerique-communication' and parent_id is null), 'community', 'Community management', '📱', array['73.11Z']::text[], array['community management']::text[], 'b2b', 123),
  ((select id from public.business_categories where slug = 'numerique-communication' and parent_id is null), 'printing', 'Imprimeries', '🖨', array['18.12Z']::text[], array['imprimeries','imprimerie']::text[], 'b2b', 124),

  -- Transport & logistique
  ((select id from public.business_categories where slug = 'transport-logistique' and parent_id is null), 'warehousing', 'Entreposage & stockage', '🏭', array['52.10B']::text[], array['entreposage','stockage']::text[], 'b2b', 125),
  ((select id from public.business_categories where slug = 'transport-logistique' and parent_id is null), 'freight', 'Messagerie & fret express', '📦', array['52.29A']::text[], array['messagerie','fret express']::text[], 'b2b', 126),

  -- Industrie (nouvelle famille)
  ((select id from public.business_categories where slug = 'industrie' and parent_id is null), 'machining', 'Usinage', '⚙️', array['25.62B']::text[], array['usinage']::text[], 'b2b', 127),
  ((select id from public.business_categories where slug = 'industrie' and parent_id is null), 'metalwork', 'Métallerie & chaudronnerie', '🔨', array['25.11Z']::text[], array['metallerie','chaudronnerie']::text[], 'b2b', 128),
  ((select id from public.business_categories where slug = 'industrie' and parent_id is null), 'wholesale', 'Grossistes', '📦', array['46.90Z']::text[], array['grossistes','commerce de gros']::text[], 'b2b', 129),

  -- Beauté & bien-être
  ((select id from public.business_categories where slug = 'beaute-bien-etre' and parent_id is null), 'makeup', 'Maquilleurs professionnels', '💄', array['96.02B']::text[], array['maquilleurs']::text[], 'b2c', 130),
  ((select id from public.business_categories where slug = 'beaute-bien-etre' and parent_id is null), 'waxing', 'Instituts d''épilation', '✨', array['96.02B']::text[], array['epilation']::text[], 'b2c', 131),

  -- Sport & loisirs
  ((select id from public.business_categories where slug = 'sport-loisirs' and parent_id is null), 'climbing', 'Salles d''escalade', '🧗', array['93.11Z']::text[], array['escalade']::text[], 'b2c', 132),
  ((select id from public.business_categories where slug = 'sport-loisirs' and parent_id is null), 'swimming', 'Piscines (établissements)', '🏊', array['93.11Z']::text[], array['piscines']::text[], 'b2c', 133),
  ((select id from public.business_categories where slug = 'sport-loisirs' and parent_id is null), 'golf', 'Golfs', '⛳', array['93.11Z']::text[], array['golf','golfs']::text[], 'b2c', 134),
  ((select id from public.business_categories where slug = 'sport-loisirs' and parent_id is null), 'bowling', 'Bowlings', '🎳', array['93.29Z']::text[], array['bowling','bowlings']::text[], 'b2c', 135),
  ((select id from public.business_categories where slug = 'sport-loisirs' and parent_id is null), 'escapegame', 'Escape games', '🔐', array['93.29Z']::text[], array['escape game']::text[], 'b2c', 136),
  ((select id from public.business_categories where slug = 'sport-loisirs' and parent_id is null), 'amusementpark', 'Parcs de loisirs', '🎢', array['93.21Z']::text[], array['parcs de loisirs']::text[], 'b2c', 137),

  -- Immobilier
  ((select id from public.business_categories where slug = 'immobilier' and parent_id is null), 'expertise', 'Experts immobiliers', '📐', array['68.31Z']::text[], array['experts immobiliers']::text[], 'b2b', 138),

  -- Commerce
  ((select id from public.business_categories where slug = 'commerce' and parent_id is null), 'petstore', 'Animaleries', '🐾', array['47.76Z']::text[], array['animaleries']::text[], 'b2c', 139),
  ((select id from public.business_categories where slug = 'commerce' and parent_id is null), 'sportinggoods', 'Magasins de sport', '⚽', array['47.64Z']::text[], array['magasins de sport']::text[], 'b2c', 140),
  ((select id from public.business_categories where slug = 'commerce' and parent_id is null), 'bikes', 'Magasins de vélos', '🚲', array['47.64Z']::text[], array['velos','velo']::text[], 'b2c', 141),
  ((select id from public.business_categories where slug = 'commerce' and parent_id is null), 'carpets', 'Tapis & moquettes', '🧶', array['47.53Z']::text[], array['tapis','moquettes']::text[], 'b2c', 142),
  ((select id from public.business_categories where slug = 'commerce' and parent_id is null), 'secondhand', 'Dépôts-vente & friperies', '👚', array['47.79Z']::text[], array['depot vente','friperie']::text[], 'b2c', 143)
on conflict (slug) do nothing;
