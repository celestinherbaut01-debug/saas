# Prospection par offre et nouvel accueil

Cette version part du commit `b7c0e01` de la branche de Claude. Elle cible le problème suivant : des recommandations de métiers différentes n'étaient pas suffisantes si les filtres et le classement restaient génériques.

## Changements visibles

- Accueil avec palette vert profond, sauge et crème, bénéfices par métier, démonstration interactive et vidéo explicative de 18 secondes sous-titrée.
- Parcours distincts pour agence web, nettoyage et garage. Le garage met la gestion d'atelier en avant ; la recherche de flottes exige une offre B2B explicite.
- Choix d'offre sous forme de cartes, rayon directement visible et filtre web nommé précisément.
- Aucun témoignage, résultat client ou chiffre de performance inventé. La démo porte une mention explicite d'exemples fictifs.
- Essai gratuit et limites repris du catalogue d'abonnements actuel. Garantie de remboursement toujours désactivée : aucune condition commerciale nouvelle n'est créée.

## Corrections fonctionnelles

1. Création de site : filtre initial « sans site renseigné sur Google ». Une fiche Google est nécessaire ; une donnée absente ou un échec de vérification ne prouve pas l'absence de site.
2. Refonte : site existant avec signal technique faible. Maintenance, SEO et acquisition digitale : site existant.
3. Nettoyage et garage : aucun critère web actif, même après une recherche d'agence web. L'état du site ne modifie plus leur score.
4. Un hôtel ou commerce reste un acheteur B2B potentiel même si ses propres clients sont des particuliers. Les exclusions liées au nom restent prises en compte.
5. Secteurs, rayon, fermetures, filtres de contact et doublons sont contrôlés à nouveau côté serveur après la réponse de Supabase. L'offre est validée contre l'activité enregistrée et les codes NAF sont reconstruits depuis les catégories.
6. Objectif et activité associés sont conservés dans le JSON de configuration existant. Les sauvegardes du formulaire sont sérialisées. Changer d'activité ou d'offre retire les anciens résultats ; une réponse tardive ne les restaure pas.
7. Une erreur réseau remet la recherche dans un état utilisable. Le métier n'est changé dans le formulaire qu'après une sauvegarde réussie.
8. Le champ de métier libre ne se ferme plus après la première lettre. Sécurité dispose de ses propres offres, distinctes du nettoyage.
9. Le détail du score suit désormais le profil réellement utilisé ; un site inconnu n'apporte plus de points.

## Vérification et limites

- Tests de régression : `cd webapp && npm test`.
- Contrôles : `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Le build est vérifié avec des valeurs Supabase factices pour le rendu public, sans connexion à la base réelle.
- La validation visuelle complète dans un navigateur, les parcours connectés et les appels réels Google/Supabase restent à tester sur un environnement accessible. Le navigateur de cette session bloque l'aperçu local.
- Le signal Google est limité à « aucun site renseigné sur la fiche », pas à une preuve multi-sources d'absence de site. Un filtre strict peut donc afficher zéro résultat lorsque la vérification est indisponible ; le message explique pourquoi.
- Le besoin réel de nettoyage, l'existence d'une flotte, le budget et les contrats en place ne sont pas connus du registre : qualification commerciale nécessaire.
- Le défaut « agence de voyage sélectionnée automatiquement » n'a pas été reproduit dans cette révision : l'onboarding initialise déjà l'activité à `null`. Un ancien profil peut toujours contenir cette valeur ; elle est modifiable depuis Prospection.

## Mise en service

Aucune migration SQL et aucun nouveau secret ne sont nécessaires à ces modifications. Le formulaire conserve la connexion Google et les routes d'authentification existantes.

La recherche issue de l'application applique les règles actuelles côté Next.js, même si l'Edge Function déployée est plus ancienne. Les deux calculs purs partagés dans `supabase/functions/_shared/` sont aussi corrigés ; redéployer `search-prospects` lors de la mise en service pour aligner les éventuels appels directs. L'application ne dispense pas d'une vérification des quotas sur l'endpoint Edge pour les clients directs (point préexistant hors du périmètre de cette refonte).

La vidéo est une explication graphique, pas une capture de données réelles. Son générateur est `webapp/scripts/generate-product-explainer.py` (Pillow et ffmpeg).

## Vérification manuelle à effectuer sur le compte de test

1. Agence web → création de site → sélectionner une zone autorisée par le forfait → seuls les résultats sans site renseigné et avec fiche Google identifiée satisfont le filtre.
2. Passer à nettoyage → bureaux, puis hôtels → secteurs différents et aucun filtre web résiduel.
3. Garage → particuliers → gestion métier ; garage → flottes → secteurs de transport, bâtiment et services mobiles, besoin de flotte à confirmer.
4. Naviguer ailleurs puis revenir → activité, offre, secteurs et rayon conservés.
5. Tester Google Sign-In, affichage mobile, vidéo et liens sur la version déployée.
