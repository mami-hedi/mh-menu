# Sécurité — MH Menu

## Isolation multi-restaurants
- Toute table métier porte `restaurant_id` ; clés étrangères composites pour interdire les références inter-restaurants.
- Le `restaurant_id` vient **toujours** de l'utilisateur chargé en base (middleware `tenant`), jamais du corps de la requête ni de l'URL.
- Test IDOR (`tests/security.test.js`) : un restaurant B ne peut ni lire, ni modifier, ni supprimer les données de A (404).

## Authentification & rôles
- Mots de passe : bcrypt (coût 12), politique 12+ caractères avec majuscule/minuscule/chiffre.
- JWT HS256, durée 7 j, révocation via `token_version` (déconnexion, changement/réinitialisation de mot de passe, suspension).
- Rôles : Super Admin, Owner, Manager, Editor ; contrôles côté serveur (balayage 401/403 sur ~50 routes en test).
- Super Admin créé uniquement par `npm run seed:admin` (jamais par inscription).
- Réinitialisation : jeton aléatoire, stocké haché, usage unique, expiration ; réponses identiques (pas d'énumération de comptes).

## Limitation de débit
- Par IP (global, authentification, inscription, réinitialisation) et par compte (10 échecs de connexion / 15 min par email).
- Derrière un proxy (Render), `trust proxy` est activé.

## En-têtes & CSP
- Backend : helmet, pas de `X-Powered-By`, CORS en liste blanche (`CLIENT_URL`), corps JSON limité, JSON invalide → 400.
- Frontend (`vercel.json`) : CSP stricte (aucun script inline), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. Validée par navigateur réel (0 violation).

## Données
- Requêtes paramétrées uniquement (tests avec charges SQLi).
- Mass assignment refusé (schémas zod stricts).
- Les hachages de mot de passe et jetons ne sont jamais renvoyés.
- Visiteurs du menu : empreinte SHA-256 salée et rotative quotidienne, aucune donnée personnelle brute.
- Logs de production sans email, mot de passe ni query string.
- `npm audit` : 0 vulnérabilité (backend et frontend) à la livraison.

## Limites connues
- Cloudinary, Resend et TiDB non testés contre les vrais services.
- Pas d'authentification à deux facteurs.
- Pas d'envoi automatique de rappels d'expiration.
