# Déploiement — MH Menu

Architecture : **Vercel** (frontend) → **Render** (API Express) → **TiDB Cloud** (MySQL) ; images sur **Cloudinary**, emails via **Resend**.

> Ces intégrations n'ont pas pu être testées contre les vrais services pendant le développement
> (base MariaDB locale, stockage d'images et envoi d'emails simulés). Suivez la liste « Premier déploiement » et
> vérifiez chaque point.

## 1. Base de données (TiDB Cloud)
1. Créer un cluster Serverless, puis une base `mh_menu`.
2. Noter hôte, port (4000), utilisateur, mot de passe. TLS obligatoire : `DB_SSL=true`.
3. Les migrations (`backend/migrations/*.sql`) sont appliquées par `npm run migrate` (idempotent, suivi dans `schema_migrations`).
   Si une migration échoue sur TiDB (différence de syntaxe), corrigez-la avant de continuer.

## 2. Backend (Render)
1. New → Blueprint → dépôt Git : `render.yaml` crée le service `mh-menu-api` (dossier `backend`).
2. Renseigner les variables marquées `sync: false` :

| Variable | Valeur |
|---|---|
| `CLIENT_URL` | URL **https** du frontend (ex. `https://menu.votredomaine.tn`). Plusieurs origines : séparées par des virgules. |
| `DB_HOST` `DB_USER` `DB_PASSWORD` `DB_NAME` | Identifiants TiDB |
| `JWT_SECRET` | `openssl rand -hex 48` (le serveur refuse de démarrer en production avec une valeur d'exemple) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Domaine d'envoi vérifié dans Resend |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Compte Cloudinary |

3. Créer le Super Admin une seule fois (Render → Shell, ou en local avec les variables de production) :
   `SUPERADMIN_EMAIL=… SUPERADMIN_PASSWORD=… npm run seed:admin`
4. Vérifier `https://<api>.onrender.com/api/health` → `{"status":"ok"}`.

Le plan gratuit de Render met le service en veille (premier appel lent) : prévoir un plan payant pour la production.

## 3. Frontend (Vercel)
1. Importer le dépôt, **Root Directory = `frontend`**, framework Vite.
2. Variable `VITE_API_URL` = URL publique de l'API (https, sans `/` final).
3. `frontend/vercel.json` applique : réécriture SPA, cache immuable de `/assets`, et les en-têtes de sécurité (CSP, HSTS, X-Frame-Options…).
4. **Domaine d'API personnalisé** : la CSP autorise `connect-src 'self' https://*.onrender.com`. Si l'API est sur un autre domaine, ajoutez-le dans `vercel.json` (`connect-src`), sinon les appels seront bloqués par le navigateur.
5. Cloudinary : les images viennent de `res.cloudinary.com` (déjà autorisé dans `img-src`).

## 4. Maintenance planifiée
`npm run maintenance` (dossier `backend`) : purge les vues de menu et journaux > 400 jours, les jetons de
réinitialisation expirés, et marque les abonnements expirés. À lancer **1 fois par jour** : cron Render (plan payant),
GitHub Actions planifié, ou service cron externe, avec les mêmes variables d'environnement que l'API.

## 5. Sauvegardes
Activer les sauvegardes TiDB Cloud (ou exporter régulièrement). Les images sont sur Cloudinary.

## 6. Premier déploiement — liste de vérification
- [ ] `/api/health` répond ; les migrations sont passées (logs Render).
- [ ] Connexion Super Admin sur `/connexion` → redirection `/admin`.
- [ ] Inscription d'un restaurant test → email de bienvenue reçu (Resend).
- [ ] « Mot de passe oublié » → email reçu, lien en https vers le bon domaine.
- [ ] `npm run check:cloudinary` (avec les variables de production) réussit ; téléversement d’un logo/produit → image servie depuis Cloudinary.
- [ ] Menu public `/r/<slug>` ouvert depuis un téléphone ; scan du QR Code OK.
- [ ] Aucune violation CSP dans la console du navigateur.
- [ ] Activation manuelle d'un abonnement par le Super Admin (page Paiements).
- [ ] Tâche `maintenance` planifiée.
- [ ] Textes légaux (CGU, confidentialité) relus par un juriste : ce sont des brouillons.

## 7. Retour arrière
Render et Vercel permettent de redéployer une version précédente. Les migrations sont additives : ne pas supprimer de colonnes sans plan de reprise.
