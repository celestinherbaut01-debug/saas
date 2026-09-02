// Catalogue métiers → codes NAF, repris du prototype (prototype/PROSPECTFLOWOSV7.html)
// pour garder la même couverture. Utilisé pour construire `nafCodes` envoyé
// à l'Edge Function search-prospects.

export const categories = [
{id:'hotels',name:'Hôtels',group:'Hébergement & tourisme',codes:['55.10Z'],icon:'🏨'},{id:'gites',name:'Gîtes & hébergements touristiques',group:'Hébergement & tourisme',codes:['55.20Z'],icon:'🛏'},{id:'campings',name:'Campings',group:'Hébergement & tourisme',codes:['55.30Z'],icon:'⛺'},{id:'travel',name:'Agences de voyage',group:'Hébergement & tourisme',codes:['79.11Z'],icon:'✈️'},
{id:'restaurants',name:'Restaurants',group:'Restauration',codes:['56.10A','56.10B','56.10C'],icon:'🍽'},{id:'fastfood',name:'Restauration rapide',group:'Restauration',codes:['56.10C'],icon:'🍔'},{id:'bars',name:'Bars & cafés',group:'Restauration',codes:['56.30Z'],icon:'☕'},{id:'catering',name:'Traiteurs',group:'Restauration',codes:['56.21Z'],icon:'🥂'},
{id:'bakery',name:'Boulangeries',group:'Commerce alimentaire',codes:['10.71C'],icon:'🥖'},{id:'butcher',name:'Boucheries',group:'Commerce alimentaire',codes:['47.22Z'],icon:'🥩'},{id:'fish',name:'Poissonneries',group:'Commerce alimentaire',codes:['47.23Z'],icon:'🐟'},{id:'wine',name:'Cavistes',group:'Commerce alimentaire',codes:['47.25Z'],icon:'🍇'},{id:'cheese',name:'Fromageries',group:'Commerce alimentaire',codes:['47.29Z'],icon:'🧀'},{id:'organic',name:'Magasins bio',group:'Commerce alimentaire',codes:['47.29Z'],icon:'🌿'},
{id:'supermarkets',name:'Supermarchés',group:'Commerce',codes:['47.11D','47.11F'],icon:'🛒'},{id:'convenience',name:'Supérettes & épiceries',group:'Commerce',codes:['47.11B','47.11C'],icon:'🏪'},{id:'clothing',name:'Magasins de vêtements',group:'Commerce',codes:['47.71Z'],icon:'👕'},{id:'shoes',name:'Magasins de chaussures',group:'Commerce',codes:['47.72A'],icon:'👟'},{id:'furniture',name:'Magasins de meubles',group:'Commerce',codes:['47.59A'],icon:'🛋'},{id:'florists',name:'Fleuristes',group:'Commerce',codes:['47.76Z'],icon:'💐'},{id:'bookstores',name:'Librairies',group:'Commerce',codes:['47.61Z'],icon:'📚'},{id:'jewelry',name:'Bijouteries',group:'Commerce',codes:['47.77Z'],icon:'💎'},{id:'toys',name:'Magasins de jouets',group:'Commerce',codes:['47.65Z'],icon:'🧸'},{id:'hardware',name:'Quincailleries & bricolage',group:'Commerce',codes:['47.52A','47.52B'],icon:'🧰'},{id:'decor',name:'Décoration & maison',group:'Commerce',codes:['47.59B'],icon:'🏺'},{id:'phone',name:'Téléphonie & électronique',group:'Commerce',codes:['47.42Z','47.43Z'],icon:'📱'},
{id:'hair',name:'Coiffeurs',group:'Beauté & bien-être',codes:['96.02A'],icon:'✂️'},{id:'beauty',name:'Instituts de beauté',group:'Beauté & bien-être',codes:['96.02B'],icon:'✨'},{id:'spa',name:'Centres bien-être / spa',group:'Beauté & bien-être',codes:['96.04Z'],icon:'🧖'},{id:'tattoo',name:'Tatoueurs',group:'Beauté & bien-être',codes:['96.09Z'],icon:'🖋'},
{id:'gyms',name:'Salles de sport',group:'Sport & loisirs',codes:['93.13Z'],icon:'🏋️'},{id:'sportsclubs',name:'Clubs de sport',group:'Sport & loisirs',codes:['93.12Z'],icon:'⚽'},{id:'events',name:'Organisateurs d’événements',group:'Sport & loisirs',codes:['82.30Z'],icon:'🎪'},
{id:'realestate',name:'Agences immobilières',group:'Immobilier',codes:['68.31Z'],icon:'🏢'},{id:'propertymgmt',name:'Syndics & administrateurs de biens',group:'Immobilier',codes:['68.32A'],icon:'🏘'},{id:'developers',name:'Promoteurs immobiliers',group:'Immobilier',codes:['41.10A','41.10B','41.10C','41.10D'],icon:'🏙'},
{id:'medical',name:'Médecins généralistes',group:'Santé',codes:['86.21Z'],icon:'🩺'},{id:'specialists',name:'Médecins spécialistes',group:'Santé',codes:['86.22A','86.22B','86.22C'],icon:'🧑‍⚕️'},{id:'dentists',name:'Cabinets dentaires',group:'Santé',codes:['86.23Z'],icon:'🦷'},{id:'nurses',name:'Infirmiers',group:'Santé',codes:['86.90D'],icon:'💉'},{id:'physio',name:'Kinésithérapeutes',group:'Santé',codes:['86.90E'],icon:'🦵'},{id:'osteo',name:'Ostéopathes & autres soins',group:'Santé',codes:['86.90F'],icon:'👐'},{id:'labs',name:'Laboratoires d’analyses',group:'Santé',codes:['86.90B'],icon:'🧪'},{id:'pharmacy',name:'Pharmacies',group:'Santé',codes:['47.73Z'],icon:'💊'},{id:'opticians',name:'Opticiens',group:'Santé',codes:['47.78A'],icon:'👓'},{id:'vets',name:'Vétérinaires',group:'Santé',codes:['75.00Z'],icon:'🐾'},{id:'ambulance',name:'Ambulances',group:'Santé',codes:['86.90A'],icon:'🚑'},
{id:'garages',name:'Garages automobiles',group:'Automobile',codes:['45.20A','45.20B'],icon:'🔧'},{id:'dealers',name:'Concessions automobiles',group:'Automobile',codes:['45.11Z'],icon:'🚗'},{id:'motorcycle',name:'Motos & deux-roues',group:'Automobile',codes:['45.40Z'],icon:'🏍'},{id:'carrental',name:'Location de voitures',group:'Automobile',codes:['77.11A','77.11B'],icon:'🚙'},{id:'drivingschool',name:'Auto-écoles',group:'Automobile',codes:['85.53Z'],icon:'🚘'},{id:'bodyshop',name:'Carrosseries',group:'Automobile',codes:['45.20A'],icon:'🛠'},{id:'tyres',name:'Pneus & centres auto',group:'Automobile',codes:['45.32Z'],icon:'🛞'},{id:'carwash',name:'Lavage automobile',group:'Automobile',codes:['45.20A'],icon:'🧽'},
{id:'plumbing',name:'Plombiers',group:'BTP & artisans',codes:['43.22A'],icon:'🔩'},{id:'heating',name:'Chauffagistes',group:'BTP & artisans',codes:['43.22B'],icon:'🔥'},{id:'electric',name:'Électriciens',group:'BTP & artisans',codes:['43.21A'],icon:'⚡'},{id:'roofing',name:'Couvreurs',group:'BTP & artisans',codes:['43.91B'],icon:'🏠'},{id:'painting',name:'Peintres en bâtiment',group:'BTP & artisans',codes:['43.34Z'],icon:'🎨'},{id:'masonry',name:'Maçons',group:'BTP & artisans',codes:['43.99C'],icon:'🧱'},{id:'carpentry',name:'Menuisiers',group:'BTP & artisans',codes:['43.32A'],icon:'🪚'},{id:'flooring',name:'Carreleurs',group:'BTP & artisans',codes:['43.33Z'],icon:'◫'},{id:'insulation',name:'Isolation',group:'BTP & artisans',codes:['43.29A'],icon:'🧤'},{id:'architects',name:'Architectes',group:'BTP & artisans',codes:['71.11Z'],icon:'📐'},{id:'landscape',name:'Paysagistes',group:'BTP & artisans',codes:['81.30Z'],icon:'🌿'},{id:'locksmith',name:'Serruriers',group:'BTP & artisans',codes:['43.32B'],icon:'🔐'},{id:'solar',name:'Installateurs photovoltaïques',group:'BTP & artisans',codes:['43.21A'],icon:'☀️'},{id:'pools',name:'Piscinistes',group:'BTP & artisans',codes:['43.99D'],icon:'🏊'},{id:'kitchens',name:'Cuisinistes',group:'BTP & artisans',codes:['43.32A'],icon:'🍳'},
{id:'cleaning',name:'Entreprises de nettoyage',group:'Services B2B',codes:['81.21Z','81.22Z'],icon:'🧹'},{id:'security',name:'Sécurité privée',group:'Services B2B',codes:['80.10Z'],icon:'🔒'},{id:'recruitment',name:'Cabinets de recrutement',group:'Services B2B',codes:['78.10Z'],icon:'🧑‍💼'},{id:'accounting',name:'Cabinets comptables',group:'Services B2B',codes:['69.20Z'],icon:'🧾'},{id:'law',name:'Avocats',group:'Services B2B',codes:['69.10Z'],icon:'⚖️'},{id:'insurance',name:'Assurances & courtiers',group:'Services B2B',codes:['66.22Z'],icon:'🛡'},{id:'consulting',name:'Cabinets de conseil',group:'Services B2B',codes:['70.22Z'],icon:'🧠'},
{id:'web',name:'Agences web & développement',group:'Numérique & communication',codes:['62.01Z','62.02A'],icon:'💻'},{id:'it',name:'Prestataires informatiques',group:'Numérique & communication',codes:['62.02A','62.09Z'],icon:'🖥'},{id:'marketing',name:'Agences marketing / publicité',group:'Numérique & communication',codes:['73.11Z'],icon:'📣'},{id:'design',name:'Designers & graphistes',group:'Numérique & communication',codes:['74.10Z'],icon:'🖌'},{id:'photo',name:'Photographes',group:'Numérique & communication',codes:['74.20Z'],icon:'📷'},
{id:'transport',name:'Transport routier',group:'Transport & logistique',codes:['49.41A','49.41B','49.41C'],icon:'🚚'},{id:'moving',name:'Déménagement',group:'Transport & logistique',codes:['49.42Z'],icon:'📦'},{id:'taxi',name:'Taxis & VTC',group:'Transport & logistique',codes:['49.32Z'],icon:'🚕'},
{id:'funeral',name:'Pompes funèbres',group:'Services locaux',codes:['96.03Z'],icon:'🕊'},{id:'laundry',name:'Pressings & blanchisseries',group:'Services locaux',codes:['96.01B'],icon:'👔'},{id:'repair',name:'Réparation informatique / appareils',group:'Services locaux',codes:['95.11Z','95.22Z'],icon:'🛠'},{id:'petgroom',name:'Toiletteurs',group:'Services locaux',codes:['96.09Z'],icon:'🐶'},
{id:'sophrology',name:'Sophrologues',group:'Bien-être & thérapies',codes:['86.90F'],icon:'🧘'},{id:'naturopathy',name:'Naturopathes',group:'Bien-être & thérapies',codes:['86.90F'],icon:'🌿'},{id:'hypnosis',name:'Hypnothérapeutes',group:'Bien-être & thérapies',codes:['86.90F'],icon:'◉'},{id:'digitopuncture',name:'Digitopuncture / digipuncture',group:'Bien-être & thérapies',codes:['86.90F'],icon:'✋'},{id:'massage',name:'Massage bien-être',group:'Bien-être & thérapies',codes:['96.04Z'],icon:'💆'},
{id:'barbers',name:'Barbiers',group:'Beauté & bien-être',codes:['96.02A'],icon:'🧔'},{id:'nails',name:'Ongleries / prothésistes ongulaires',group:'Beauté & bien-être',codes:['96.02B'],icon:'💅'},
{id:'dance',name:'Écoles de danse',group:'Éducation & sport',codes:['85.52Z'],icon:'💃'},{id:'yoga',name:'Yoga / pilates',group:'Éducation & sport',codes:['85.51Z'],icon:'🧘'},
];

/** Regroupe les catégories par famille, pour l'affichage en colonnes. */
export function categoriesByGroup() {
  const groups = new Map();
  for (const c of categories) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  return groups;
}

export function nafCodesForSelection(selectedIds) {
  const set = new Set();
  for (const id of selectedIds) {
    const cat = categories.find((c) => c.id === id);
    cat?.codes.forEach((code) => set.add(code));
  }
  return [...set];
}

/** Options du sélecteur "famille métier" (profil entreprise). */
export const businessTypes = [
  ["web_agency", "Agence web / création de sites"],
  ["garage", "Garage / atelier automobile"],
  ["hair", "Coiffeur / barbier"],
  ["beauty", "Institut beauté / esthétique"],
  ["wellness", "Bien-être / digitopuncture / thérapeute"],
  ["restaurant", "Restaurant / restauration"],
  ["bakery", "Boulangerie / pâtisserie"],
  ["retail", "Commerce / magasin"],
  ["cleaning", "Nettoyage professionnel"],
  ["construction", "BTP / artisan"],
  ["plumber", "Plomberie / chauffage"],
  ["electrician", "Électricité"],
  ["landscape", "Paysage / espaces verts"],
  ["realestate", "Agence immobilière"],
  ["health", "Cabinet de santé"],
  ["consulting", "Conseil / services B2B"],
  ["generic", "Autre entreprise"],
];
