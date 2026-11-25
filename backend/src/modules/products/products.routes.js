import { Router } from 'express';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { uploadMany } from '../../middlewares/upload.js';
import { idParams, idAndChild, reorderBody } from '../../utils/common.js';
import { createProductSchema, listQuery, updateProductSchema } from './products.validation.js';
import * as svc from './products.service.js';

const router = Router();
const canManage = requireRole(ROLES.OWNER, ROLES.MANAGER); // suppression : owner, manager

router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => res.json(await svc.list(req.restaurantId, req.query))));

router.post('/', validate(createProductSchema), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.create(req.restaurantId, req.user.id, req.body, req.ip))));

router.put('/reorder', validate(reorderBody), asyncHandler(async (req, res) => {
  await svc.reorder(req.restaurantId, req.user.id, req.body.ids, req.ip);
  res.status(204).end();
}));

router.get('/:id', validate(idParams, 'params'), asyncHandler(async (req, res) => res.json(await svc.getOne(req.restaurantId, req.params.id))));

router.patch('/:id', validate(idParams, 'params'), validate(updateProductSchema), asyncHandler(async (req, res) =>
  res.json(await svc.update(req.restaurantId, req.user.id, req.params.id, req.body, req.ip))));

router.delete('/:id', canManage, validate(idParams, 'params'), asyncHandler(async (req, res) => {
  await svc.remove(req.restaurantId, req.user.id, req.params.id, req.ip);
  res.status(204).end();
}));

router.post('/:id/duplicate', validate(idParams, 'params'), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.duplicate(req.restaurantId, req.user.id, req.params.id, req.ip))));

router.post('/:id/images', validate(idParams, 'params'), uploadMany('images'), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.addImages(req.restaurantId, req.user.id, req.params.id, req.files, req.ip))));

router.put('/:id/images/reorder', validate(idParams, 'params'), validate(reorderBody), asyncHandler(async (req, res) =>
  res.json(await svc.reorderImages(req.restaurantId, req.params.id, req.body.ids))));

router.delete('/:id/images/:imageId', validate(idAndChild('imageId'), 'params'), asyncHandler(async (req, res) =>
  res.json(await svc.removeImage(req.restaurantId, req.user.id, req.params.id, req.params.imageId, req.ip))));

export default router;
