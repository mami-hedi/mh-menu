# MH Menu – Installation (phases 1 à 5)

## Prérequis
Node.js 20+, un cluster TiDB Cloud (MySQL), un compte Resend (domaine vérifié).

## Démarrage local
```bash
cd backend
npm install
cp .env.example .env        # puis renseigner les valeurs
npm run migrate             # crée les tables, les 3 plans et applique les migrations 001 à 004
npm run seed:admin          # crée le Super Admin depuis SUPERADMIN_* (.env)
npm run dev                 # http://localhost:4000/api/health
npm test                    # nécessite une base MySQL/TiDB de test (voir .env)
```

## TiDB Cloud
- Créer un cluster Starter, une base `mh_menu`, puis un utilisateur SQL.
- Reporter hôte, port (4000), utilisateur et mot de passe dans `.env` ; garder `DB_SSL=true`.
- Autoriser l'IP de sortie de Render dans la liste d'accès du cluster (ou ouvrir l'accès public).
- Les tests suppriment des données : n'utiliser qu'une base de test dédiée.

## Render (backend)
- Service Web, racine `backend`, build `npm install`, start `npm start`.
- Variables : toutes celles de `.env.example`, avec `NODE_ENV=production` et `CLIENT_URL=https://<votre-domaine-vercel>`.
- Après le premier déploiement : exécuter `npm run migrate` puis `npm run seed:admin` (Shell Render ou en local vers TiDB).

## Resend
Vérifier le domaine d'envoi, créer une clé API, puis `RESEND_API_KEY` et `EMAIL_FROM` (adresse du domaine vérifié).

## Cloudinary
Créer un compte, puis renseigner `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` dans `backend/.env` (et sur Render). Sans ces variables, l'envoi d'images répond 503 `STORAGE_NOT_CONFIGURED`. Les images sont rangées dans `mh-menu/r<id restaurant>/...`. Après mise à jour, relancer `npm run migrate` (migration 004).

## Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, /api relayé vers http://localhost:4000
npm run build      # génère dist/
```

## Activer un abonnement (Super Admin)
Après avoir reçu un paiement (espèces, virement, D17 ou Flouci), ouvrez `/admin`, trouvez le restaurant, puis « Activer un abonnement » : choisissez l'offre, le montant reçu, le mode et la date. Un renouvellement ajoute la durée à la fin de l'abonnement en cours. « Offrir des jours » sert aux gestes commerciaux et « Suspendre » bloque les connexions du restaurant et son menu public. Aucune intégration bancaire n'existe : tout est saisi manuellement.

## Menu public et QR Codes
Le menu public est servi par le frontend à l'adresse `https://<votre-domaine>/r/<slug>` ; les QR Codes sont générés dans le navigateur (aucun service externe) et encodent cette adresse, basée sur le slug qui ne change jamais. `CLIENT_URL` (backend) doit contenir l'adresse du frontend pour que l'API publique accepte les appels du navigateur. Le fichier `frontend/vercel.json` redirige déjà `/r/*` vers l'application.

## Vercel (frontend)
- Importer le dépôt, **Root Directory** : `frontend`, framework Vite (build `npm run build`, sortie `dist`).
- Variable : `VITE_API_URL=https://<votre-service>.onrender.com` (sans `/api` final).
- `vercel.json` gère la réécriture SPA (les URLs `/dashboard`, `/connexion`... fonctionnent au rechargement).
- Côté Render, `CLIENT_URL` doit contenir l'URL Vercel exacte (CORS et liens des emails).
  Plusieurs origines possibles, séparées par des virgules (la première sert aux liens des emails).

## Configurer Cloudinary (images)

1. Créez un compte gratuit sur https://cloudinary.com (le plan gratuit suffit pour démarrer).
2. Tableau de bord → **Settings → API Keys** (ou « Programmable Media → Dashboard ») : copiez **Cloud name**, **API Key** et **API Secret**.
3. Dans `backend/.env` :
   ```
   CLOUDINARY_CLOUD_NAME=votre-cloud-name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=votre-secret
   ```
   Sans espace, sans guillemets. Ne partagez jamais l'API Secret.
4. Vérifiez : `cd backend && npm run check:cloudinary` doit afficher « Cloudinary est prêt ».
5. Redémarrez le backend (`npm run dev`) : le message « Cloudinary non configuré » doit disparaître.
6. Dans le dashboard : Informations (logo, couverture), Catégories ou Produits → téléversez une image (JPG, PNG ou WebP).

Les images sont rangées par restaurant (`mh-menu/r<id>/…`) et optimisées automatiquement à l'affichage (format et qualité).
Si l'envoi échoue, le message d'erreur de `check:cloudinary` indique quelle variable corriger.
