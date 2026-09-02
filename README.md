# ProspectFlow OS — backend Starter

Ce dépôt contient le vrai backend du moteur de qualité des prospects décrit
dans le prototype (`prototype/PROSPECTFLOWOSV7.html`, gardé tel quel comme
référence visuelle — il n'est pas encore branché sur ce backend).

Portée actuelle : **plan Starter uniquement** — trouver et vérifier des
prospects, sans envoi automatique d'emails. C'est volontairement l'étape 1
sur 3 (Starter → Pro → Max).

## Ce qui est réel ici (plus une simulation)

- **Schéma Supabase** (`supabase/migrations/0001_init_schema.sql`) : `profiles`,
  `search_zones`, `prospects` (le CRM), `verification_cache`, avec Row Level
  Security — chaque utilisateur ne voit que ses propres données.
- **Edge Function `search-prospects`** (`supabase/functions/search-prospects`) :
  1. Interroge le vrai registre officiel des entreprises françaises (SIRENE/RNE
     via [recherche-entreprises.api.gouv.fr](https://recherche-entreprises.api.gouv.fr),
     API publique, gratuite, sans clé) filtré par code(s) NAF et position GPS.
  2. Recalcule la distance exacte (Haversine) depuis le point géocodé et rejette
     tout ce qui dépasse le rayon demandé.
  3. Applique les filtres d'indépendance : associations/secteur public (code
     "nature juridique" INSEE), gros groupes (tranche d'effectif ≥ 250 salariés),
     chaînes/franchises connues (`supabase/functions/_shared/chains.ts`), et
     un plafond d'établissements par SIREN.
  4. Vérifie chaque établissement restant via **Google Places API (New)** :
     statut opérationnel, site web, téléphone, avis — avec un cache par SIRET
     (`verification_cache`, TTL 30 jours) pour ne pas repayer l'API à chaque
     recherche qui retombe sur le même établissement.
  5. Analyse sommairement la qualité du site trouvé (accessible, HTTPS,
     responsive) pour le classer none/weak/ok/unknown.
  6. Calcule un score d'opportunité 0-100 explicable (`_shared/scoring.ts`).
  7. Retourne les résultats **sans rien écrire dans le CRM** — l'ajout au CRM
     se fait depuis le client avec un insert normal sur `prospects` (protégé
     par RLS avec le JWT de l'utilisateur), pour garder la main sur "j'ajoute
     cette sélection" comme dans le prototype.

**Règle agent respectée** : si `GOOGLE_MAPS_API_KEY` n'est pas configurée, ou
si Google ne répond pas pour un établissement donné, celui-ci reste marqué
`business_status: "unverified"` / `website_quality: "unknown"` — jamais
requalifié par défaut en "opérationnel" ou "site correct".

## Ce qui n'est toujours pas fait

- Frontend réel branché sur ce backend (le prototype HTML reste une maquette).
- Auth (Google Sign-In / Gmail séparés), Stripe, envoi Gmail, scheduler de
  relances, agent IA — prévus pour les étapes Pro/Max.
- CASA/vérification Google pour les scopes Gmail sensibles — pas nécessaire
  tant que Starter (pas d'envoi automatique) n'est pas dépassé.

## Mise en route

```bash
# 1. Lier le projet Supabase (créé sur supabase.com)
supabase link --project-ref <votre-project-ref>

# 2. Appliquer le schéma
supabase db push

# 3. Configurer la clé Google Places (Cloud Console → activer "Places API (New)")
supabase secrets set GOOGLE_MAPS_API_KEY=xxxxx

# 4. Déployer la fonction
supabase functions deploy search-prospects
```

Appel depuis le client (avec `supabase-js`, JWT utilisateur automatiquement
inclus) :

```ts
const { data, error } = await supabase.functions.invoke("search-prospects", {
  body: {
    lat: 50.1766, lng: 3.235, radiusKm: 20,
    nafCodes: ["45.20A", "45.20B"], // ex. garages
    filters: {
      operationalOnly: true, excludeTempClosed: true, excludeChains: true,
      excludeAssociations: true, excludeLargeGroups: true, needContact: false,
      maxEstablishmentsPerSiren: 8, webFilter: "no_or_weak",
    },
  },
});
```

## Notes de coût et de limites à connaître

- **SIRENE/RNE** : gratuit, sans clé, mais son filtre géographique
  `lat/long/radius` ne cherche pas au-delà de **50 km** — pour un rayon
  demandé plus large, la fonction plafonne la requête à 50 km (limite de
  l'API elle-même, pas un bug côté backend).
- **Google Places (New)** : facturé à l'appel (Text Search + Place Details
  par établissement vérifié). La fonction plafonne à 25 vérifications par
  recherche par défaut (`maxPlacesLookups`, 60 max) et met en cache 30 jours
  par SIRET — à chiffrer précisément avant de fixer le prix Starter.
- **RGPD** : ce backend ne gère pas encore l'envoi d'emails (plan Pro), donc
  pas de lien de désinscription à ce stade — à ajouter avant d'activer l'envoi
  automatique.
