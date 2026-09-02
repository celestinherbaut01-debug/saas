# ProspectFlow OS

SaaS B2B français : trouver de vraies entreprises, les vérifier (registre
officiel + Google), scorer l'opportunité, et (dans les phases suivantes) les
démarcher avec un agent IA tout en tenant un CRM persistant. Aucune donnée
fictive : ce qui n'est pas vérifié affiche "à vérifier", jamais une
supposition présentée comme un fait.

Le projet se construit **par phases** (voir plus bas). Ce README documente
l'état réel à chaque instant — pas une roadmap marketing.

## Où est le code

| Dossier | Rôle | État |
|---|---|---|
| `webapp/` | **L'application réelle** (Next.js/TypeScript/Tailwind) : compte, workspace, onboarding, bientôt prospection/CRM/agent IA/Stripe. | Phase 1 terminée |
| `supabase/` | Backend partagé : migrations SQL + Edge Function `search-prospects` (registre SIRENE/RNE + Google Places + scoring). | Le moteur de recherche existe et fonctionne, pas encore branché sur `webapp/` (Phase 3) |
| `web/` | Ancien frontend statique HTML/JS (avant le passage à Next.js). | **Legacy** — gardé pour référence, plus le produit |
| `prototype/` | Maquette HTML d'origine, jamais branchée à un backend. | **Legacy** — référence visuelle uniquement |

## Phase 1 — ce qui est réel aujourd'hui

- **Auth réelle** : email/mot de passe + **vraie connexion Google OAuth**
  (`webapp/src/components/google-button.tsx` appelle
  `supabase.auth.signInWithOAuth({ provider: "google" })` — un vrai écran de
  sélection de compte Google s'ouvre, rien n'est simulé). Routes `/login`,
  `/signup`, `/auth/callback`.
- **Workspaces multi-tenant** (`supabase/migrations/0002_workspaces.sql`) :
  une entreprise = un `workspace`, avec des membres (`workspace_members`,
  rôles owner/admin/member) — plus jamais de donnée rattachée directement à
  un `user_id`. RLS via `is_workspace_member()`.
- **Onboarding réel** (`/onboarding`) en 5 étapes : entreprise → votre métier
  → métiers à démarcher → zone de prospection → vérification. Écrit
  vraiment en base (`business_profiles`, `workspace_targets`) à la fin.
- **Catalogue de métiers en base**, pas dans un fichier JS statique
  (`business_categories`, 98 métiers / 16 familles, seedés dans
  `0003_seed_categories.sql` depuis l'ancien `web/js/categories.js`).
  Recherche floue réelle (extensions Postgres `unaccent` + `pg_trgm`) :
  taper "digi" trouve "Digitopuncture / digipuncture", "garage" trouve
  "Garages automobiles" — ce ne sont pas des cas codés en dur, c'est la
  recherche qui fonctionne comme ça sur les 98 lignes. Sélecteur avec
  recherche, groupes, "tout sélectionner par famille", recommandations
  selon le métier propre du workspace.
- **Localisation réelle** : autocomplétion d'adresse + géocodage via la
  Base Adresse Nationale (gratuite, sans clé), et un vrai bouton "Utiliser
  ma position" (`navigator.geolocation`, `enableHighAccuracy: true`).
- **Dashboard** avec des vraies requêtes en base — compteurs à 0 tant que
  les fonctionnalités correspondantes n'existent pas encore (pas de faux
  chiffres).

## Ce qui n'est pas encore fait

Tout le reste du cahier des charges (Gmail, Stripe, agent IA NOVA, CRM
persistant, Business OS par métier, etc.) — prévu phase par phase :

1. ~~Supabase + workspace + onboarding~~ ✅ (ce README)
2. ~~Catalogue métiers + sélecteur de cibles + localisation~~ ✅
3. Brancher `search-prospects` (déjà fonctionnel dans `supabase/`) sur `webapp/`
4. Filtrage fermés/chaînes + audit qualité de site
5. CRM persistant + timeline d'activité + score explicable
6. Agent IA NOVA (chat + outils sur les vraies données)
7. Gmail (envoi réel uniquement — **pas de lecture automatique des réponses
   pour l'instant**, donc pas besoin de vérification CASA restreinte tant
   que ce choix tient) + campagnes + relances
8. Google Calendar + récap quotidien + jobs en tâche de fond
9. Stripe (Starter/Pro/Max réels, feature gating serveur)
10. Business OS par métier (Garage OS, Salon OS, etc.)
11. Tests, sécurité, perf

## Mise en route — Phase 1 (`webapp/`)

Pensé pour quelqu'un qui n'est pas développeur : chaque étape dit où cliquer.

### 1. Créer le projet Supabase
[supabase.com](https://supabase.com) → **New project** → choisissez un nom
et un mot de passe de base de données (à garder de côté) → attendez la fin
du provisionnement (~2 min).

### 2. Appliquer les migrations SQL
Le plus simple sans rien installer : Dashboard Supabase → **SQL Editor** →
**New query** → collez le contenu de chacun de ces fichiers **dans l'ordre**
et cliquez **Run** :
1. `supabase/migrations/0001_init_schema.sql`
2. `supabase/migrations/0002_workspaces.sql`
3. `supabase/migrations/0003_seed_categories.sql`

(Alternative avec le CLI : `supabase link --project-ref <ref> && supabase db push`.)

### 3. Récupérer les clés Supabase
Dashboard → **Project Settings** (icône engrenage) → **API** :
- `Project URL` → deviendra `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → deviendra `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Ces deux valeurs sont faites pour être publiques (la sécurité vient de la
Row Level Security appliquée à l'étape 2), vous pouvez me les donner
directement pour que je configure `webapp/.env.local`.

### 4. Créer les identifiants Google OAuth
[console.cloud.google.com](https://console.cloud.google.com) :
1. Créez un projet (ou utilisez un projet existant).
2. Menu ☰ → **APIs & Services** → **OAuth consent screen** → type
   **External** → remplissez nom de l'app + email support + email
   développeur → **Save and continue** (les scopes par défaut suffisent
   pour l'instant, pas besoin d'en ajouter).
3. Menu ☰ → **APIs & Services** → **Credentials** → **+ Create Credentials**
   → **OAuth client ID** → type **Web application**.
4. Dans **Authorized redirect URIs**, ajoutez :
   `https://<votre-project-ref>.supabase.co/auth/v1/callback`
   (le `<votre-project-ref>` est dans votre `Project URL` de l'étape 3).
5. **Create** → copiez le **Client ID** et le **Client secret** affichés.

### 5. Activer Google dans Supabase Auth
Dashboard Supabase → **Authentication** → **Sign In / Providers** →
**Google** → activez, collez le **Client ID** et **Client secret** de
l'étape 4 → **Save**.

### 6. Configurer les URLs de redirection
Dashboard Supabase → **Authentication** → **URL Configuration** :
- **Site URL** : `http://localhost:3000` (en local)
- **Redirect URLs** : ajoutez `http://localhost:3000/auth/callback`

(Ajoutez votre domaine de production aux deux quand vous déployez.)

### 7. Lancer l'application
```bash
cd webapp
npm install
cp .env.local.example .env.local   # puis remplir avec les valeurs de l'étape 3
npm run dev
```
→ [http://localhost:3000](http://localhost:3000)

Parcours à tester : Démarrer gratuitement → Continuer avec Google (vrai
écran Google) → onboarding en 5 étapes → dashboard.

## Le moteur de recherche (`supabase/`, existant, pas encore branché)

Le dossier `supabase/functions/search-prospects` contient déjà une vraie
pipeline de vérification (registre SIRENE/RNE, distance Haversine exacte,
filtres indépendance/chaînes, Google Places, analyse de site, score
d'opportunité) — construite avant `webapp/` et pas encore reliée à
l'interface Next.js (Phase 3). Détails techniques :

- **SIRENE/RNE** : gratuit, sans clé, via
  [recherche-entreprises.api.gouv.fr](https://recherche-entreprises.api.gouv.fr)
  (endpoint `/near_point` pour la recherche géographique — vérifié dans le
  code source public de l'API, rayon plafonné à 50 km).
- **Google Places (New)** : facturé à l'appel — la fonction plafonne à 25
  vérifications par recherche par défaut (`maxPlacesLookups`, 60 max) et
  met en cache 30 jours par SIRET (`verification_cache`) pour ne pas
  repayer l'API à chaque recherche qui retombe sur le même établissement.
- Si `GOOGLE_MAPS_API_KEY` n'est pas configurée, ou si Google ne répond pas,
  l'établissement reste marqué "à vérifier" — jamais requalifié par défaut.

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=xxxxx
supabase functions deploy search-prospects
```

## Notes de coût à garder en tête

- Google Places facture à l'appel — à chiffrer précisément avant de fixer
  le prix du plan Starter (25 vérifications/recherche par défaut).
- RGPD : l'envoi d'emails (Phase 7) devra inclure un lien de désinscription
  avant tout envoi réel en prospection froide.
