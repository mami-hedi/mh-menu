import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { queryOne } from '../config/db.js';
import { forbidden, unauthorized, asyncHandler } from '../utils/errors.js';
import { getAccessState } from '../modules/subscriptions/subscription.service.js';

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  EDITOR: 'editor',
});

export function signToken(user) {
  return jwt.sign({ sub: user.id, tv: user.token_version }, env.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: env.jwt.expiresIn,
  });
}

/**
 * Vérifie le JWT puis recharge l'utilisateur en base : rôle et restaurant_id ne viennent
 * JAMAIS du token, ce qui permet de révoquer un accès (désactivation, changement de mot de passe,
 * suspension du restaurant) sans attendre l'expiration du jeton.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Session expirée ou invalide.');
  }

  const user = await queryOne(
    `SELECT u.id, u.restaurant_id, u.name, u.email, u.role, u.is_active, u.token_version, r.status AS restaurant_status
       FROM users u
       LEFT JOIN restaurants r ON r.id = u.restaurant_id
      WHERE u.id = ?`,
    [payload.sub]
  );

  if (!user || !user.is_active || user.token_version !== payload.tv) throw unauthorized('Session expirée ou invalide.');
  if (user.role !== ROLES.SUPER_ADMIN && user.restaurant_status !== 'active') {
    throw forbidden('Ce compte est suspendu. Contactez MH Digital Solution.', 'ACCOUNT_SUSPENDED');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurant_id,
  };
  next();
});

/** Autorise uniquement les rôles listés. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(forbidden('Permissions insuffisantes.'));
    next();
  };

/**
 * Contexte multi-tenant : req.restaurantId provient exclusivement de l'utilisateur authentifié.
 * Les services métier doivent TOUJOURS filtrer sur req.restaurantId, jamais sur un id fourni par le client.
 */
export const tenant = (req, _res, next) => {
  if (!req.user?.restaurantId) return next(forbidden('Espace réservé aux restaurants.'));
  req.restaurantId = req.user.restaurantId;
  next();
};

/** Bloque les écritures quand l'essai est terminé ou l'abonnement expiré/annulé (lecture et souscription restent possibles). */
export const requireActiveSubscription = asyncHandler(async (req, _res, next) => {
  const access = await getAccessState(req.restaurantId);
  if (!access.canWrite) {
    throw forbidden('Votre essai ou abonnement est terminé. Souscrivez à une offre pour continuer.', 'SUBSCRIPTION_REQUIRED');
  }
  req.subscription = access;
  next();
});
