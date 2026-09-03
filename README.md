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
| `webapp/` | **L'application réelle** (Next.js/TypeScript/Tailwind) : compte, workspace, onboarding, prospection, CRM. Bientôt agent IA/Gmail/Stripe. | Phases 1 et 3 terminées |
| `supabase/` | Backend partagé : migrations SQL + Edge Function `search-prospects` (registre SIRENE/RNE + Google Places + scoring). | Branché sur `webapp/` (page Prospection) |
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

## Phase 3 — ce qui est réel depuis cette étape

- **`/prospection`** : la page appelle réellement l'Edge Function
  `search-prospects` (`webapp/src/components/prospection/prospection-view.tsx`)
  avec le sélecteur de cibles et l'adresse de l'onboarding en pré-remplissage.
  Résultats affichés avec statut Google, qualité de site et score, tels que
  renvoyés par le vrai pipeline — pas de simulation.
- **`/crm`** : liste les prospects réellement ajoutés (table `prospects`,
  RLS par workspace), changement de statut persistant en base.
- Le dashboard affiche désormais un vrai compteur de prospects (plus une
  valeur figée à 0).
- Chaque prospect a un bouton **Voir le site** (si confirmé), **Vérifier sur
  Google** (fiche réelle par `place_id`, ou recherche par nom+adresse à
  défaut) et **Appeler** (`tel:`) — jamais de lien fabriqué.

## Phases suivantes — ce qui est réel depuis cette étape

- **`/crm/[id]`** : fiche prospect avec timeline d'activité réelle
  (`activities`, alimentée à chaque ajout au CRM / changement de statut /
  note manuelle), notes persistantes, et **"Pourquoi ce score ?"** qui
  détaille chaque ligne du calcul (`lib/score-breakdown.ts`, reflète
  exactement `supabase/functions/_shared/scoring.ts`).
- **`/parametres`** : édition du profil entreprise + les 3 plans
  (Starter/Pro/Max) affichés depuis une vraie table `subscriptions`
  (auto-créée en Starter à la création du workspace). Paiement Stripe pas
  encore branché — clairement indiqué, pas de faux bouton "Payer".
- **`lib/plan.ts`** : `requirePlan()`/`getWorkspacePlan()`, la vérité côté
  serveur sur le plan — utilisé pour gater `/business-os`, pas juste caché
  côté client.
- **`/agent`** : NOVA, un vrai agent avec 3 outils (`get_daily_summary`,
  `search_prospects`, `get_prospect`) qui lisent votre base réelle via
  l'API Anthropic (tool-calling). Sans `ANTHROPIC_API_KEY`, affiche
  clairement "non configuré" — ne répond jamais par une supposition.
- **`/integrations`** : état réel de chaque connexion (Google Sign-In,
  NOVA, Stripe) lu depuis la session/l'environnement, jamais codé en dur.
- **`/business-os`** (plan Max uniquement, vérifié serveur) : 3 modules
  réutilisables — Clients, Stock, Rendez-vous (`customers`,
  `inventory_items`, `appointments`) — avec un vocabulaire qui change selon
  le métier du workspace (ex. "Pièces" pour un garage, "Ingrédients" pour
  un restaurant, cf. `lib/business-os.ts`). CRUD réel, pas de données
  d'exemple.

## Ce qui n'est pas encore fait

1. ~~Supabase + workspace + onboarding~~ ✅
2. ~~Catalogue métiers + sélecteur de cibles + localisation~~ ✅
3. ~~Brancher `search-prospects` sur `webapp/` (Prospection + CRM)~~ ✅
4. Audit de site plus poussé (le check actuel est sommaire : HTTPS +
   viewport ; pas de capture d'écran, pas de détection CTA/formulaire/SEO)
5. ~~Timeline d'activité + score explicable~~ ✅
6. ~~Agent IA NOVA (scaffold + 3 outils réels)~~ ✅ — reste à ajouter
   `sendEmail`, `scheduleFollowup`, etc. une fois Gmail branché (phase 7)
7. Gmail (envoi réel — **pas de lecture automatique des réponses pour
   l'instant**, donc pas besoin de CASA tant que ce choix tient) +
   campagnes + relances automatiques + classification des réponses
8. Google Calendar + récap quotidien envoyé automatiquement + jobs en
   tâche de fond (nécessite un scheduler : `pg_cron` Supabase ou Vercel Cron)
9. ~~Table `subscriptions` + gating serveur~~ ✅ — reste Stripe Checkout /
   Customer Portal / webhooks (aucune clé Stripe fournie pour l'instant)
10. ~~Business OS (architecture modulaire, 3 modules, plan Max)~~ ✅ — reste
    à enrichir (modules "fournisseurs"/"projets" pour d'autres métiers)
11. Tests automatisés, audit sécurité, performance

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
4. `supabase/migrations/0004_activities.sql`
5. `supabase/migrations/0005_subscriptions.sql`
6. `supabase/migrations/0006_business_os.sql`
7. `supabase/migrations/0007_plans_quotas.sql` (plan Free + quotas réels)
8. `supabase/migrations/0008_xp.sql` (gamification XP)

Toutes ces migrations sont rejouables sans risque (idempotentes) : en cas
de doute sur ce qui a déjà été exécuté, vous pouvez relancer 0001 à 0008
dans l'ordre sans perdre de données.

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
écran Google) → onboarding en 5 étapes → dashboard → Prospection (vraie
recherche) → CRM.

### 8. (Optionnel) Activer l'agent IA NOVA
[console.anthropic.com](https://console.anthropic.com) → **API Keys** →
**Create Key** → copiez la clé → ajoutez-la à `webapp/.env.local` :
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
```
Redémarrez `npm run dev`. Sans cette clé, `/agent` fonctionne quand même
mais affiche clairement "non configuré" — jamais une fausse réponse.

### 9. (Optionnel) Stripe — pas encore branché
Une clé `STRIPE_SECRET_KEY` peut déjà être ajoutée à `.env.local` (voir
`.env.local.example`), mais aucun Checkout n'existe encore dans le code :
la page **Paramètres → Abonnement** reste en lecture seule tant que cette
intégration n'est pas construite (prochaine phase).

## Le moteur de recherche (`supabase/functions/search-prospects`)

Contient la vraie pipeline de vérification (registre SIRENE/RNE, distance
Haversine exacte, filtres indépendance/chaînes, Google Places, analyse de
site, score d'opportunité) — appelée directement par `/prospection`.
Détails techniques :

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
