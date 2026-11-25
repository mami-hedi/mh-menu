import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { idParams } from '../../utils/common.js';
import * as svc from './team.service.js';

// Gestion de l'équipe : réservée au propriétaire
const router = Router();
router.use(requireRole(ROLES.OWNER));

const email = z.string().trim().toLowerCase().max(190, 'Email trop long.').email('Email invalide.');
const password = z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères.').max(72, 'Le mot de passe ne doit pas dépasser 72 caractères.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.').regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre.');
const phone = z.string().trim().regex(/^\+?[0-9 .-]{8,20}$/, 'Numéro de téléphone invalide.');
const role = z.enum(['manager', 'editor'], 'Rôle invalide.');

const createSchema = z.object({ name: z.string().trim().min(2, 'Nom requis.').max(120), email, phone: phone.nullish(), role, password });
const updateSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis.').max(120).optional(),
  phone: phone.nullable().optional(),
  role: role.optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });

router.get('/', asyncHandler(async (req, res) => res.json(await svc.list(req.restaurantId, req.user.id))));
router.post('/', validate(createSchema), asyncHandler(async (req, res) => res.status(201).json(await svc.create(req.restaurantId, req.user, req.body, req.ip))));
router.patch('/:id', validate(idParams, 'params'), validate(updateSchema), asyncHandler(async (req, res) => res.json(await svc.update(req.restaurantId, req.user, req.params.id, req.body, req.ip))));
router.post('/:id/password', validate(idParams, 'params'), validate(z.object({ password })), asyncHandler(async (req, res) => { await svc.setPassword(req.restaurantId, req.user, req.params.id, req.body.password, req.ip); res.status(204).end(); }));
router.delete('/:id', validate(idParams, 'params'), asyncHandler(async (req, res) => { await svc.remove(req.restaurantId, req.user, req.params.id, req.ip); res.status(204).end(); }));

export default router;
