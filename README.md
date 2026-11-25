# MH Menu – Votre menu digital. Simplement.

SaaS multi-tenant de menus digitaux par QR Code pour restaurants, cafés, pizzerias et snacks.
Développé par **MH Digital Solution**.

Ce paquet est **cumulatif** : il contient les phases 1 à 7 (version complète).

| Phase | Contenu | État |
|---|---|---|
| 1 | Architecture, base MySQL (17 tables, migrations), authentification, multi-tenant | Livrée |
| 2 | Landing page, inscription, connexion, mot de passe oublié, tableau de bord restaurant | Livrée |
| 3 | Catégories, produits, variantes/suppléments, paramètres (Cloudinary) | Livrée |
| 4 | Menu public `/r/:slug` (3 modèles), panier virtuel « Présenter au serveur », QR Codes (principal + tables) | Livrée |
| 5 | Abonnements, activation manuelle des paiements, espace Super Admin (restaurants, paiements, support) | Livrée |
| 6 | Tests, audit sécurité, responsive + accessibilité, optimisation, déploiement (Render, Vercel, CI) | Livrée |
| 7 | Statistiques de fréquentation, gestion de l'équipe (Manager/Éditeur), coordonnées de paiement | Livrée |

## Structure

```
mh-menu/
├── backend/    API Node.js / Express / MySQL (TiDB Cloud)
├── frontend/   React 19 + Vite + Tailwind CSS 4
└── docs/       INSTALL.md, API.md, DEPLOY.md, SECURITY.md, TESTING.md
```

## Démarrage rapide

```bash
# 1) Backend
cd backend && npm install
cp .env.example .env          # renseigner DB_*, JWT_SECRET, RESEND_*...
npm run migrate               # crée les tables et les 3 plans
npm run seed:admin            # crée le Super Admin (SUPERADMIN_* dans .env)
npm run dev                   # http://localhost:4000

# 2) Frontend (autre terminal)
cd frontend && npm install
npm run dev                   # http://localhost:5173 (le proxy Vite relaie /api vers le backend)
```

Détails de déploiement (TiDB Cloud, Render, Vercel, Resend) : `docs/INSTALL.md`.
Référence des routes : `docs/API.md`.

## Tests

```bash
cd backend && npm test        # 62 tests : auth, essai, isolation multi-tenant, catalogue, rôles, images, menu public, QR Codes, abonnements, Super Admin, support
```

Les tests s'exécutent sur une base **dédiée** (ils créent et suppriment des données).

## Points à valider avant la mise en production

- Textes légaux (CGU, confidentialité, mentions légales) : textes de base à faire valider, et à compléter avec la raison sociale, le matricule fiscal et l'adresse.
- Domaine d'envoi Resend à vérifier (`EMAIL_FROM`).
- Compte Super Admin : défini uniquement par variables d'environnement, jamais dans le code.
