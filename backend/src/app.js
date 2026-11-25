import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { globalLimiter } from './middlewares/rateLimit.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import { authenticate, tenant, requireRole, requireActiveSubscription, ROLES } from './middlewares/auth.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import menuRoutes from './modules/menu/menu.routes.js';
import qrRoutes from './modules/qrcodes/qrcodes.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';
import teamRoutes from './modules/team/team.routes.js';
import { getPaymentInfo } from './modules/platform/platform.service.js';
import { getAccessState } from './modules/subscriptions/subscription.service.js';
import { getDashboard, getSubscriptionHistory } from './modules/dashboard/dashboard.service.js';
import { asyncHandler } from './utils/errors.js';

export function createApp() {
  const app = express();

  // Render place l'application derrière un proxy : nécessaire pour que le rate limiting voie la vraie IP
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(compression());
  // Journal d'accès minimal (méthode, chemin sans query string, statut, durée) : aucune donnée personnelle ni jeton
  if (env.isProd) {
    app.use((req, res, next) => {
      const t = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`));
      next();
    });
  }
  app.use(
    cors({
      origin(origin, cb) {
        // Pas d'en-tête Origin = appel serveur à serveur ou outil de test : autorisé (aucun cookie n'est utilisé)
        if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', globalLimiter);

  app.get('/api/health', asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  }));

  app.use('/api/auth', authRoutes);
  // Menu consultable sans compte (clients des restaurants) : lecture seule, aucune donnée interne
  app.use('/api/public', publicRoutes);

  // Espace restaurant : exemple de chaîne de middlewares multi-tenant, réutilisée par les modules des phases suivantes
  const restaurantRouter = express.Router();
  restaurantRouter.use(authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.EDITOR), tenant);
  // Support : toujours ouvert (même abonnement terminé)
  restaurantRouter.use('/support', supportRoutes);
  // Lecture toujours possible ; toute écriture exige un essai ou abonnement actif
  restaurantRouter.use((req, res, next) => (req.method === 'GET' ? next() : requireActiveSubscription(req, res, next)));
  restaurantRouter.get('/subscription', asyncHandler(async (req, res) => {
    res.json(await getAccessState(req.restaurantId));
  }));
  restaurantRouter.get('/subscription/history', asyncHandler(async (req, res) => {
    res.json(await getSubscriptionHistory(req.restaurantId));
  }));
  restaurantRouter.get('/dashboard', asyncHandler(async (req, res) => {
    res.json(await getDashboard(req.restaurantId));
  }));
  // Coordonnées de paiement de MH Digital Solution (lecture seule pour tous les rôles du restaurant)
  restaurantRouter.get('/payment-info', asyncHandler(async (_req, res) => res.json(await getPaymentInfo())));
  restaurantRouter.use('/stats', statsRoutes);
  restaurantRouter.use('/team', teamRoutes);
  restaurantRouter.use('/categories', categoriesRoutes);
  restaurantRouter.use('/products', productsRoutes);
  restaurantRouter.use('/settings', settingsRoutes);
  restaurantRouter.use('/menu', menuRoutes);
  restaurantRouter.use('/qrcodes', qrRoutes);
  app.use('/api/restaurant', restaurantRouter);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
