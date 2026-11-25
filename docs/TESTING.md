# Tests — MH Menu

## Backend (automatisés)
Base MySQL/MariaDB de test requise (variables comme `.env.example`, `NODE_ENV=test`, base dédiée).

    cd backend && npm run migrate && npm test

62 tests : authentification et essai, isolation multi-tenant, catalogue, rôles, images (stockage simulé),
menu public, QR Codes, abonnements et Super Admin, support, limitation de débit (limites réelles via `TEST_REAL_LIMITS`),
sécurité (JWT falsifiés, CORS, IDOR, injection SQL, mass assignment, fuites de hachages, énumération, configuration de production).

## Frontend
`npm run build` (CI). Parcours de bout en bout, balayage responsive (320/375/768/1280 px) et audit axe-core
ont été exécutés avec Playwright pendant le développement (scripts non inclus dans l'archive).

## Vérification manuelle recommandée avant mise en production
Voir la liste de `docs/DEPLOY.md` §6, plus : test sur un vrai téléphone (iOS Safari, Android Chrome), impression d'un QR Code,
lecteur d'écran sur le menu public.
