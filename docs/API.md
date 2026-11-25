# MH Menu – API (phases 1 à 5)

Base : `/api`. Authentification : `Authorization: Bearer <jeton>`.
Erreurs : `{ "error": { "code", "message", "details?" } }`.

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | /health | public | Vérifie l'API et la base |
| POST | /auth/register | public | Crée restaurant + propriétaire + essai de 3 jours. Corps : restaurantName, ownerName, email, phone, password, confirmPassword |
| POST | /auth/login | public | email, password → token, user, restaurant, subscription |
| GET | /auth/me | connecté | Profil, restaurant, état de l'abonnement |
| POST | /auth/logout | connecté | Révoque tous les jetons de l'utilisateur |
| POST | /auth/forgot-password | public | Réponse neutre, email Resend (lien valable 1 h) |
| POST | /auth/reset-password | public | token, password, confirmPassword (lien à usage unique) |
| GET | /restaurant/subscription | owner/manager/editor | Statut effectif, jours restants, canWrite |
| GET | /restaurant/subscription/history | owner/manager/editor | Historique des abonnements et montants réglés |
| GET | /restaurant/dashboard | owner/manager/editor | Produits (total/disponibles/indisponibles), catégories, consultations (total + 7 jours), 10 dernières activités |
| PATCH | /auth/me | connecté | Met à jour nom, téléphone |
| POST | /auth/change-password | connecté | currentPassword, password, confirmPassword → nouveau jeton (les anciens sont révoqués) |
| GET | /restaurant/categories | owner/manager/editor | Liste avec nombre de produits |
| POST | /restaurant/categories | owner/manager/editor | name, description?, isActive? (nom unique par restaurant) |
| PUT | /restaurant/categories/reorder | owner/manager/editor | `{ ids: [...] }` nouvel ordre |
| PATCH | /restaurant/categories/:id | owner/manager/editor | Mise à jour partielle |
| DELETE | /restaurant/categories/:id | owner/manager | Supprime (produits liés conservés sans catégorie) |
| PUT / DELETE | /restaurant/categories/:id/image | owner/manager/editor | Image (multipart `image`) |
| GET | /restaurant/products | owner/manager/editor | Filtres : categoryId, available, promo, search, page |
| POST | /restaurant/products | owner/manager/editor | Produit + variantes + suppléments (prix en DT, ≥ 0) |
| GET / PATCH | /restaurant/products/:id | owner/manager/editor | Détail complet / mise à jour partielle |
| DELETE | /restaurant/products/:id | owner/manager | Supprime produit et photos |
| POST | /restaurant/products/:id/duplicate | owner/manager/editor | Copie options et photos |
| PUT | /restaurant/products/reorder | owner/manager/editor | `{ ids: [...] }` |
| POST | /restaurant/products/:id/images | owner/manager/editor | multipart `images` (max 6 par produit) |
| PUT | /restaurant/products/:id/images/reorder | owner/manager/editor | `{ ids: [...] }` |
| DELETE | /restaurant/products/:id/images/:imageId | owner/manager/editor | Supprime une photo |
| GET / PUT | /restaurant/settings | owner/manager | Informations, horaires, réseaux, couleurs (le slug ne change jamais) |
| PUT / DELETE | /restaurant/settings/images/:kind | owner/manager | `kind` = logo ou cover (multipart `image`) |
| GET / PUT | /restaurant/menu | owner/manager | template (`classic`, `modern`, `compact`), cartEnabled, isPublished, allowIndexing, showPopular |
| GET | /restaurant/qrcodes | owner/manager/editor | `{ slug, tables: [...] }` (le QR principal pointe vers `/r/<slug>`) |
| POST | /restaurant/qrcodes | owner/manager | `{ tableLabel }` (40 car. max, unique sans tenir compte de la casse, 200 tables max) |
| POST | /restaurant/qrcodes/bulk | owner/manager | `{ from, to, prefix? }` (100 tables max à la fois, existantes ignorées) |
| DELETE | /restaurant/qrcodes/:id | owner/manager | Supprime un QR Code de table (le principal est protégé) |
| GET / POST | /restaurant/support | tous les rôles | Mes demandes / nouvelle demande (`subject`, `message`). **Reste ouvert même si l'abonnement est terminé** ; 10 demandes en cours maximum |

### Routes Super Admin (`/api/admin`, rôle `super_admin` uniquement)

| Méthode | Route | Description |
|---|---|---|
| GET | /admin/stats | Restaurants par statut effectif, fins proches (3 jours), nouveaux inscrits, encaissements (mois, total, 6 mois), demandes ouvertes |
| GET | /admin/restaurants?filter=&q=&page= | Liste paginée (20) ; `filter` : trial, active, expired, cancelled, suspended, expiring ; `q` : nom, adresse du menu, nom/e-mail du propriétaire |
| GET | /admin/restaurants/:id | Fiche : utilisateurs (sans hash), abonnements, paiements, compteurs, activité récente |
| POST | /admin/restaurants/:id/activate | `{ planCode: monthly\|yearly, method: cash\|bank_transfer\|d17\|flouci\|other, amountDt?, reference?, paidAt?, notes? }` : active l'abonnement ou, s'il est déjà actif, **ajoute la durée à sa fin** ; enregistre le paiement (montant par défaut = prix de l'offre) |
| POST | /admin/restaurants/:id/grant-days | `{ days: 1-365, notes? }` : prolonge la période en cours ou rouvre un essai ; aucun paiement |
| POST | /admin/restaurants/:id/cancel | Annule l'abonnement en cours (409 s'il n'y en a pas) |
| POST | /admin/restaurants/:id/suspend, /reactivate | Suspend / réactive le restaurant (connexion et menu public bloqués) |
| GET | /admin/payments?page= | Tous les paiements enregistrés |
| GET | /admin/tickets?status=&page= | Demandes de support |
| GET / PATCH | /admin/tickets/:id | Détail ; `{ status?, adminReply? }` (la réponse est envoyée par e-mail au propriétaire via Resend) |

Les actions Super Admin sont tracées dans les journaux d'activité du restaurant concerné. Le Super Admin n'a aucun accès aux routes `/restaurant/*` (pas de contexte restaurant) et un propriétaire reçoit 403 sur `/admin/*`.

### Routes publiques (sans authentification)

| Méthode | Route | Description |
|---|---|---|
| GET | /public/menu/:slug?table= | Menu complet : restaurant, réglages d'affichage, catégories actives non vides avec produits actifs (variantes, suppléments, photos). Produits indisponibles inclus avec `isAvailable: false`. Cache navigateur 10 s |
| POST | /public/menu/:slug/view?table= | Compte une consultation (hash salé quotidien du visiteur, une fois par demi-heure) ; `{ counted }` |

Le menu public répond 404 si le slug est inconnu et 403 `MENU_UNAVAILABLE` si le menu est masqué, le restaurant suspendu ou l'abonnement terminé. Il n'expose aucun identifiant interne de restaurant, e-mail ou identifiant d'image. Limite : 120 requêtes par minute et par IP.

Toutes les routes `/restaurant/* hors GET exigent un abonnement actif (essai ou payant). Images : JPEG, PNG ou WebP, 5 Mo max, type vérifié sur le contenu.

Codes métier : `SUBSCRIPTION_REQUIRED` (403, écriture bloquée), `ACCOUNT_SUSPENDED` (403), `RATE_LIMITED` (429), `STORAGE_NOT_CONFIGURED` (503, Cloudinary absent), `UPLOAD_ERROR` (400/413, image invalide ou trop lourde), `MENU_UNAVAILABLE` (403, menu public non consultable).

## Phase 6 — durcissement

- `POST /api/auth/login` : en plus de la limite par IP, **10 échecs / 15 min par email** → `429 RATE_LIMITED` (les connexions réussies ne comptent pas).
- Réponses compressées (gzip) ; `GET /api/public/menu/:slug` : `Cache-Control: public, max-age=10`.
- JSON invalide → `400 BAD_JSON` ; corps trop volumineux → `413`.
- Production : le serveur refuse de démarrer avec un `JWT_SECRET` d'exemple ou un `CLIENT_URL` non https.
- Script `npm run maintenance` : purge des données anciennes et passage des abonnements échus à `expired`.

## Phase 7 — statistiques, équipe, paiement

| Méthode | Route | Rôles | Description |
|---|---|---|---|
| GET | `/api/restaurant/stats?days=7\|30\|90` | Owner, Manager | Consultations par jour et par heure, par table, comparaison avec la période précédente (heure de Tunisie, UTC+1) |
| GET | `/api/restaurant/team` | Owner | Membres du restaurant (10 maximum) |
| POST | `/api/restaurant/team` | Owner | Crée un Manager ou un Éditeur `{name,email,phone?,role,password}` (409 si l'email existe) |
| PATCH | `/api/restaurant/team/:id` | Owner | Modifie nom, téléphone, rôle, `isActive` (coupe les sessions du membre) |
| POST | `/api/restaurant/team/:id/password` | Owner | Réinitialise le mot de passe (coupe les sessions) |
| DELETE | `/api/restaurant/team/:id` | Owner | Retire un membre (le propriétaire et soi-même sont protégés) |
| GET | `/api/restaurant/payment-info` | tous rôles restaurant | Coordonnées de paiement de MH Digital Solution |
| GET/PUT | `/api/admin/payment-info` | Super Admin | Lecture / modification (banque, RIB, D17, Flouci, contact, instructions) |

Migration `005_platform_settings.sql` (table `platform_settings`). Les vues du menu sont désormais horodatées en UTC par l'application (indépendant du fuseau du serveur MySQL).
