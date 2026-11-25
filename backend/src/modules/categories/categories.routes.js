import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { uploadSingle } from '../../middlewares/upload.js';
import { idParams, optionalText, reorderBody } from '../../utils/common.js';
import * as svc from './categories.service.js';

const router = Router();
// Création / modification : owner, manager, editor. Suppression : owner, manager.
const canManage = requireRole(ROLES.OWNER, ROLES.MANAGER);

const name = z.string().trim().min(1, 'Nom requis.').max(100, '100 caractères maximum.');
const createSchema = z.object({ name, description: optionalText(255), isActive: z.boolean().optional() });
const updateSchema = z.object({ name: name.optional(), description: optionalText(255).optional(), isActive: z.boolean().optional() });

router.get('/', asyncHandler(async (req, res) => res.json(await svc.list(req.restaurantId))));

router.post('/', validate(createSchema), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.create(req.restaurantId, req.user.id, req.body, req.ip))));

// /reorder avant /:id pour ne pas être capturé comme identifiant
router.put('/reorder', validate(reorderBody), asyncHandler(async (req, res) =>
  res.json(await svc.reorder(req.restaurantId, req.user.id, req.body.ids, req.ip))));

router.patch('/:id', validate(idParams, 'params'), validate(updateSchema), asyncHandler(async (req, res) =>
  res.json(await svc.update(req.restaurantId, req.user.id, req.params.id, req.body, req.ip))));

router.delete('/:id', canManage, validate(idParams, 'params'), asyncHandler(async (req, res) => {
  await svc.remove(req.restaurantId, req.user.id, req.params.id, req.ip);
  res.status(204).end();
}));

router.put('/:id/image', validate(idParams, 'params'), uploadSingle('image'), asyncHandler(async (req, res) =>
  res.json(await svc.setImage(req.restaurantId, req.user.id, req.params.id, req.file, req.ip))));

router.delete('/:id/image', validate(idParams, 'params'), asyncHandler(async (req, res) =>
  res.json(await svc.removeImage(req.restaurantId, req.user.id, req.params.id, req.ip))));

export default router;
