import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { query, queryOne } from '../../config/db.js';
import { buildUpdate } from '../../utils/common.js';
import { logActivity } from '../../utils/activity.js';

const router = Router();
router.use(requireRole(ROLES.OWNER, ROLES.MANAGER));

const toApi = (m) => ({
  template: m.template, cartEnabled: !!m.cart_enabled, isPublished: !!m.is_published,
  allowIndexing: !!m.allow_indexing, showPopular: !!m.show_popular,
});
const get = async (rid) => toApi(await queryOne('SELECT * FROM menus WHERE restaurant_id = ?', [rid]));

const schema = z.object({
  template: z.enum(['classic', 'modern', 'compact']).optional(),
  cartEnabled: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  allowIndexing: z.boolean().optional(),
  showPopular: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => res.json(await get(req.restaurantId))));

router.put('/', validate(schema), asyncHandler(async (req, res) => {
  const { sets, params } = buildUpdate(
    { template: 'template', cartEnabled: 'cart_enabled', isPublished: 'is_published', allowIndexing: 'allow_indexing', showPopular: 'show_popular' },
    req.body
  );
  if (sets.length) await query(`UPDATE menus SET ${sets.join(', ')} WHERE restaurant_id = ?`, [...params, req.restaurantId]);
  await logActivity({ restaurantId: req.restaurantId, userId: req.user.id, action: 'menu.updated', entity: 'menu', ip: req.ip });
  res.json(await get(req.restaurantId));
}));

export default router;
