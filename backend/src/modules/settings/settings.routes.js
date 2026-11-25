import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { uploadSingle } from '../../middlewares/upload.js';
import { optionalText } from '../../utils/common.js';
import * as svc from './settings.service.js';

const router = Router();
// Les informations du restaurant sont réservées au propriétaire et aux managers
router.use(requireRole(ROLES.OWNER, ROLES.MANAGER));

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:MM).');
const day = z.object({ closed: z.boolean(), open: time, close: time });
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const openingHours = z.object(Object.fromEntries(DAYS.map((d) => [d, day]))).nullable();

// Seuls http(s) sont acceptés : on bloque javascript:, data:, etc. (liens affichés sur le menu public)
const httpUrl = z.string().trim().max(300).refine((v) => {
  try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; }
}, 'Lien invalide (https://…).');
const link = httpUrl.or(z.literal('')).optional();
const socialLinks = z
  .object({
    facebook: link,
    instagram: link,
    tiktok: link,
    website: link,
    whatsapp: z.string().trim().regex(/^\+?[0-9 .-]{8,20}$/, 'Numéro invalide.').or(z.literal('')).optional(),
  })
  .transform((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v)))
  .nullable();

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#RRGGBB).');

const updateSchema = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères.').max(120).optional(),
  description: optionalText(1000).optional(),
  address: optionalText(255).optional(),
  phone: z.string().trim().regex(/^\+?[0-9 .-]{8,20}$/, 'Numéro invalide.').or(z.literal('')).transform((v) => v || null).nullish().optional(),
  openingHours: openingHours.optional(),
  socialLinks: socialLinks.optional(),
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
});

const kindParam = z.object({ kind: z.enum(['logo', 'cover']) });

router.get('/', asyncHandler(async (req, res) => res.json(await svc.get(req.restaurantId))));
router.put('/', validate(updateSchema), asyncHandler(async (req, res) => res.json(await svc.update(req.restaurantId, req.user.id, req.body, req.ip))));

router.put('/images/:kind', validate(kindParam, 'params'), uploadSingle('image'), asyncHandler(async (req, res) =>
  res.json(await svc.setImage(req.restaurantId, req.user.id, req.params.kind, req.file, req.ip))));
router.delete('/images/:kind', validate(kindParam, 'params'), asyncHandler(async (req, res) =>
  res.json(await svc.removeImage(req.restaurantId, req.user.id, req.params.kind, req.ip))));

export default router;
