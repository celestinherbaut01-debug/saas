-- Taxonomie métier : la table business_categories est déjà arborescente
-- (parent_id) et déjà cherchable (search_text généré depuis name+keywords,
-- unaccent + trigram) — pas de nouvelle table nécessaire. Ce qui manquait
-- réellement : des synonymes/alias insuffisants pour certains métiers à
-- fort trafic, ce qui faisait échouer une recherche par nom courant plutôt
-- que par intitulé officiel (ex. "agent immo" ne retrouvait pas "Agences
-- immobilières", faute du mot "agent" dans les mots-clés).
--
-- keywords[] EST le mécanisme d'alias (un profession_aliases séparé
-- dupliquerait ce qui existe déjà) : cette migration l'enrichit pour les
-- métiers explicitement testés et les verticales déjà profondes (Garage,
-- Nettoyage, Agence, Restaurant) sans toucher la structure de l'arbre.

update public.business_categories
set keywords = keywords || array['agent immobilier','agent','agents immobiliers','agence','agences']
where slug = 'realestate' and 'agent immobilier' != all(keywords);

update public.business_categories
set keywords = keywords || array['plaquiste','plaquistes','plaquiste platrier']
where slug = 'plastering' and 'plaquiste' != all(keywords);

update public.business_categories
set keywords = keywords || array['societe de nettoyage','entreprise de nettoyage','nettoyage bureaux','nettoyage locaux','proprete','agent de proprete']
where slug = 'cleaning' and 'entreprise de nettoyage' != all(keywords);

update public.business_categories
set keywords = keywords || array['garage','garage auto','reparation automobile','mecanique automobile','centre auto']
where slug = 'garages' and 'reparation automobile' != all(keywords);

update public.business_categories
set keywords = keywords || array['agence de creation de sites','site vitrine','site internet','developpeur web','webdesigner']
where slug = 'web' and 'site vitrine' != all(keywords);

update public.business_categories
set keywords = keywords || array['restaurant gastronomique','brasserie','pizzeria']
where slug = 'restaurants' and 'brasserie' != all(keywords);

update public.business_categories
set keywords = keywords || array['plombier chauffagiste','depannage plomberie']
where slug = 'plumbing' and 'depannage plomberie' != all(keywords);

update public.business_categories
set keywords = keywords || array['electricien batiment','depannage electrique','installation electrique']
where slug = 'electric' and 'electricien batiment' != all(keywords);

update public.business_categories
set keywords = keywords || array['carrossier','reparation carrosserie']
where slug = 'bodyshop' and 'carrossier' != all(keywords);

update public.business_categories
set keywords = keywords || array['centre de controle technique','controle technique auto']
where slug = 'inspection' and 'centre de controle technique' != all(keywords);

update public.business_categories
set keywords = keywords || array['pneumaticien','centre de montage pneus']
where slug = 'tyres' and 'pneumaticien' != all(keywords);

update public.business_categories
set keywords = keywords || array['salon de coiffure','barbier','coiffure homme','coiffure femme']
where slug = 'hair' and 'barbier' != all(keywords);

update public.business_categories
set keywords = keywords || array['esthéticienne','institut','soins du visage']
where slug = 'beauty' and 'institut' != all(keywords);

update public.business_categories
set keywords = keywords || array['agence de communication','agence de com','strategie digitale']
where slug = 'marketing' and 'agence de communication' != all(keywords);
