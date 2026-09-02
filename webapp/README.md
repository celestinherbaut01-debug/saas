# ProspectFlow OS — webapp

Application Next.js réelle du projet. Voir le [README à la racine du dépôt](../README.md)
pour le contexte produit complet et les instructions de configuration
(Supabase, Google OAuth) étape par étape.

## Développement local

```bash
npm install
cp .env.local.example .env.local   # remplir avec vos clés Supabase
npm run dev
```

## Commandes

- `npm run dev` — serveur de développement
- `npm run build` — build de production (inclut le typecheck)
- `npm run lint` — ESLint
