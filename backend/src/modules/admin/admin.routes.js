import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireRole, ROLES } from '../../middlewares/auth.js';
import { id, idParams, money, optionalText } from '../../utils/common.js';
import * as svc from './admin.service.js';
import { getPaymentInfo, setPaymentInfo } from '../platform/platform.service.js';

const router = Router();
// Espace Super Admin : aucun contexte restaurant, accès réservé au rôle super_admin
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN));

const page = z.coerce.number().int().min(1).max(10000).default(1);

router.get('/stats', asyncHandler(async (_req, res) => res.json(await svc.stats())));

const listQuery = z.object({
  filter: z.enum(['trial', 'active', 'expired', 'cancelled', 'suspended', 'expiring']).optional(),
  q: z.string().trim().max(100).optional(),
  page,
});
router.get('/restaurants', validate(listQuery, 'query'), asyncHandler(async (req, res) => res.json(await svc.listRestaurants(req.query))));
router.get('/restaurants/:id', validate(idParams, 'params'), asyncHandler(async (req, res) => res.json(await svc.getRestaurant(req.params.id))));

const activateSchema = z.object({
  planCode: z.enum(['monthly', 'yearly']),
  amountDt: money.optional(),
  method: z.enum(['cash', 'bank_transfer', 'd17', 'flouci', 'other']),
  reference: optionalText(100),
  paidAt: z.iso.datetime({ offset: true }).optional(),
  notes: optionalText(255),
});
router.post('/restaurants/:id/activate', validate(idParams, 'params'), validate(activateSchema), asyncHandler(async (req, res) =>
  res.json(await svc.activate(req.params.id, req.user.id, req.body, req.ip))));

router.post('/restaurants/:id/grant-days', validate(idParams, 'params'), validate(z.object({ days: z.number().int().min(1).max(365), notes: optionalText(255) })), asyncHandler(async (req, res) =>
  res.json(await svc.grantDays(req.params.id, req.user.id, req.body, req.ip))));

router.post('/restaurants/:id/cancel', validate(idParams, 'params'), validate(z.object({ notes: optionalText(255) })), asyncHandler(async (req, res) =>
  res.json(await svc.cancel(req.params.id, req.user.id, req.body, req.ip))));

router.post('/restaurants/:id/suspend', validate(idParams, 'params'), asyncHandler(async (req, res) => res.json(await svc.setSuspended(req.params.id, req.user.id, true, req.ip))));
router.post('/restaurants/:id/reactivate', validate(idParams, 'params'), asyncHandler(async (req, res) => res.json(await svc.setSuspended(req.params.id, req.user.id, false, req.ip))));

router.get('/payments', validate(z.object({ page }), 'query'), asyncHandler(async (req, res) => res.json(await svc.listPayments(req.query.page))));

router.get('/tickets', validate(z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(), page }), 'query'), asyncHandler(async (req, res) => res.json(await svc.listTickets(req.query))));
router.get('/tickets/:id', validate(idParams, 'params'), asyncHandler(async (req, res) => res.json(await svc.getTicket(req.params.id))));
router.patch('/tickets/:id', validate(idParams, 'params'), validate(z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  adminReply: z.string().trim().min(1, 'Réponse vide.').max(3000).optional(),
}).refine((v) => v.status || v.adminReply, { message: 'Rien à modifier.' })), asyncHandler(async (req, res) =>
  res.json(await svc.updateTicket(req.params.id, req.user.id, req.body, req.ip))));

const txt = (max) => z.string().trim().max(max, `${max} caractères maximum.`).nullish().transform((v) => v || null);
const paymentSchema = z.object({
  instructions: txt(1000), bankName: txt(80), accountHolder: txt(120),
  rib: txt(40).refine((v) => v === null || /^[A-Za-z0-9 ]{8,40}$/.test(v), 'RIB / IBAN invalide.'),
  d17: txt(20).refine((v) => v === null || /^\+?[0-9 .-]{8,20}$/.test(v), 'Numéro invalide.'),
  flouci: txt(20).refine((v) => v === null || /^\+?[0-9 .-]{8,20}$/.test(v), 'Numéro invalide.'),
  contactPhone: txt(20).refine((v) => v === null || /^\+?[0-9 .-]{8,20}$/.test(v), 'Numéro invalide.'),
  contactEmail: txt(190).refine((v) => v === null || z.email().safeParse(v).success, 'Email invalide.'),
});
router.get('/payment-info', asyncHandler(async (_req, res) => res.json(await getPaymentInfo())));
router.put('/payment-info', validate(paymentSchema), asyncHandler(async (req, res) => res.json(await setPaymentInfo(req.body, req.user.id))));

export default router;
