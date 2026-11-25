import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, conflict, notFound } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, ROLES } from '../../middlewares/auth.js';
import { query, queryOne } from '../../config/db.js';
import { idParams } from '../../utils/common.js';
import { logActivity } from '../../utils/activity.js';

const router = Router();
const canManage = requireRole(ROLES.OWNER, ROLES.MANAGER);
const MAX_TABLES = 200;

// Étiquette de table : texte simple (pas de caractère de contrôle), 40 caractères maximum
const label = z.string().trim().min(1, 'Étiquette requise.').max(40, '40 caractères maximum.')
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'Caractères invalides.');

const toApi = (r) => ({ id: r.id, tableLabel: r.table_label, createdAt: new Date(r.created_at).toISOString() });
const list = async (rid) => (await query('SELECT id, table_label, created_at FROM qr_codes WHERE restaurant_id = ? AND table_label IS NOT NULL ORDER BY id', [rid])).map(toApi);

// Le QR Code principal (ligne sans table, créée à l'inscription) : il pointe vers /r/<slug>, qui ne change jamais.
router.get('/', asyncHandler(async (req, res) => {
  const r = await queryOne('SELECT slug FROM restaurants WHERE id = ?', [req.restaurantId]);
  res.json({ slug: r.slug, tables: await list(req.restaurantId) });
}));

async function insertLabels(rid, labels) {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM qr_codes WHERE restaurant_id = ? AND table_label IS NOT NULL', [rid]);
  if (Number(n) + labels.length > MAX_TABLES) throw conflict(`Maximum ${MAX_TABLES} QR Codes de table.`);
  const existing = new Set((await query('SELECT table_label FROM qr_codes WHERE restaurant_id = ? AND table_label IS NOT NULL', [rid])).map((x) => x.table_label.toLowerCase()));
  const fresh = labels.filter((l) => !existing.has(l.toLowerCase()));
  for (const l of fresh) await query('INSERT INTO qr_codes (restaurant_id, table_label) VALUES (?, ?)', [rid, l]);
  return fresh.length;
}

router.post('/', canManage, validate(z.object({ tableLabel: label })), asyncHandler(async (req, res) => {
  if (!(await insertLabels(req.restaurantId, [req.body.tableLabel]))) throw conflict('Cette table existe déjà.');
  await logActivity({ restaurantId: req.restaurantId, userId: req.user.id, action: 'qrcode.created', entity: 'qr_code', ip: req.ip });
  res.status(201).json({ tables: await list(req.restaurantId) });
}));

// Création en série : tables 1 à N (ex. 1 → 20), préfixe facultatif
const bulk = z.object({ from: z.number().int().min(1).max(999), to: z.number().int().min(1).max(999), prefix: z.string().trim().max(20).optional() })
  .refine((v) => v.to >= v.from, { message: 'La fin doit être supérieure ou égale au début.', path: ['to'] })
  .refine((v) => v.to - v.from < 100, { message: '100 tables maximum à la fois.', path: ['to'] });
router.post('/bulk', canManage, validate(bulk), asyncHandler(async (req, res) => {
  const { from, to, prefix } = req.body;
  const labels = [];
  for (let i = from; i <= to; i++) labels.push(`${prefix ? `${prefix} ` : ''}${i}`.slice(0, 40));
  const created = await insertLabels(req.restaurantId, labels);
  await logActivity({ restaurantId: req.restaurantId, userId: req.user.id, action: 'qrcode.created', entity: 'qr_code', meta: { count: created }, ip: req.ip });
  res.status(201).json({ created, tables: await list(req.restaurantId) });
}));

router.delete('/:id', canManage, validate(idParams, 'params'), asyncHandler(async (req, res) => {
  // Le QR Code principal (sans table) ne peut pas être supprimé
  const row = await queryOne('SELECT id FROM qr_codes WHERE id = ? AND restaurant_id = ? AND table_label IS NOT NULL', [req.params.id, req.restaurantId]);
  if (!row) throw notFound('QR Code introuvable.');
  await query('DELETE FROM qr_codes WHERE id = ? AND restaurant_id = ?', [row.id, req.restaurantId]);
  await logActivity({ restaurantId: req.restaurantId, userId: req.user.id, action: 'qrcode.deleted', entity: 'qr_code', entityId: row.id, ip: req.ip });
  res.json({ ok: true });
}));

export default router;
