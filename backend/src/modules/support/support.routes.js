import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { query } from '../../config/db.js';
import { logActivity } from '../../utils/activity.js';

// Support : accessible même quand l'essai est terminé (c'est le canal pour demander l'activation d'un abonnement)
const router = Router();
const MAX_OPEN = 10;

const toApi = (t) => ({ id: t.id, subject: t.subject, message: t.message, status: t.status, adminReply: t.admin_reply, createdAt: new Date(t.created_at).toISOString(), updatedAt: new Date(t.updated_at).toISOString() });

router.get('/', asyncHandler(async (req, res) => {
  const rows = await query('SELECT id, subject, message, status, admin_reply, created_at, updated_at FROM support_tickets WHERE restaurant_id = ? ORDER BY id DESC LIMIT 50', [req.restaurantId]);
  res.json(rows.map(toApi));
}));

router.post('/', validate(z.object({
  subject: z.string().trim().min(3, 'Objet trop court.').max(150, '150 caractères maximum.'),
  message: z.string().trim().min(10, 'Message trop court (10 caractères minimum).').max(3000, '3000 caractères maximum.'),
})), asyncHandler(async (req, res) => {
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM support_tickets WHERE restaurant_id = ? AND status IN ('open','in_progress')`, [req.restaurantId]);
  if (Number(n) >= MAX_OPEN) throw badRequest(`Vous avez déjà ${MAX_OPEN} demandes en cours. Attendez une réponse avant d'en créer une nouvelle.`);
  const r = await query('INSERT INTO support_tickets (restaurant_id, user_id, subject, message) VALUES (?, ?, ?, ?)', [req.restaurantId, req.user.id, req.body.subject, req.body.message]);
  await logActivity({ restaurantId: req.restaurantId, userId: req.user.id, action: 'ticket.created', entity: 'support_ticket', entityId: r.insertId, ip: req.ip });
  const rows = await query('SELECT id, subject, message, status, admin_reply, created_at, updated_at FROM support_tickets WHERE id = ? AND restaurant_id = ?', [r.insertId, req.restaurantId]);
  res.status(201).json(toApi(rows[0]));
}));

export default router;
