import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { getStats, RANGES } from './stats.service.js';

const router = Router();
router.use(requireRole(ROLES.OWNER, ROLES.MANAGER));

const q = z.object({ days: z.coerce.number().int().refine((n) => RANGES.includes(n), 'Période invalide (7, 30 ou 90 jours).').default(7) });
router.get('/', validate(q, 'query'), asyncHandler(async (req, res) => res.json(await getStats(req.restaurantId, req.query.days))));

export default router;
