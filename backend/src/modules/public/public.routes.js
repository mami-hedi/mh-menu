import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { env } from '../../config/env.js';
import * as svc from './public.service.js';

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans un instant.' } },
});
router.use(publicLimiter);

const slugParam = z.object({ slug: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Adresse invalide.') });
const tableQuery = z.object({ table: z.string().trim().max(40).optional() });

router.get('/menu/:slug', validate(slugParam, 'params'), validate(tableQuery, 'query'), asyncHandler(async (req, res) => {
  // Court cache navigateur/CDN : une modification du menu apparaît en quelques secondes
  res.set('Cache-Control', 'public, max-age=10');
  res.json(await svc.getPublicMenu(req.params.slug, req.query.table));
}));

router.post('/menu/:slug/view', validate(slugParam, 'params'), validate(tableQuery, 'query'), asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await svc.recordView(req.params.slug, { ip: req.ip, userAgent: req.get('user-agent'), tableLabel: req.query.table }));
}));

export default router;
