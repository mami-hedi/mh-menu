import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit: env.isTest && !process.env.TEST_REAL_LIMITS ? 10_000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message } },
  });

export const globalLimiter = make(15 * 60_000, 600, 'Trop de requêtes. Réessayez dans quelques minutes.');
export const loginLimiter = make(15 * 60_000, 10, 'Trop de tentatives de connexion. Réessayez dans 15 minutes.');
export const registerLimiter = make(60 * 60_000, 10, "Trop d'inscriptions depuis cette adresse. Réessayez plus tard.");
export const passwordResetLimiter = make(60 * 60_000, 5, 'Trop de demandes de réinitialisation. Réessayez plus tard.');

// Freine le bourrage d'identifiants : 10 échecs par adresse e-mail et par 15 minutes, quelle que soit l'IP
// (les connexions réussies ne comptent pas). La clé est l'e-mail normalisé.
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.isTest && !process.env.TEST_REAL_LIMITS ? 10_000 : 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `acct:${String(req.body?.email ?? '').trim().toLowerCase().slice(0, 190)}`,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives sur ce compte. Réessayez dans 15 minutes.' } },
});
