import bcrypt from 'bcrypt';
import { query, queryOne } from '../../config/db.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { logActivity } from '../../utils/activity.js';

const BCRYPT_COST = 12;
export const MAX_MEMBERS = 10;

const toApi = (u, currentUserId) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone ?? null, role: u.role, isActive: !!u.is_active,
  lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
  createdAt: new Date(u.created_at).toISOString(), isMe: u.id === currentUserId,
});

const COLS = 'id, name, email, phone, role, is_active, last_login_at, created_at';

export async function list(restaurantId, currentUserId) {
  const rows = await query(
    `SELECT ${COLS} FROM users WHERE restaurant_id = ? ORDER BY FIELD(role, 'owner', 'manager', 'editor'), name`,
    [restaurantId]
  );
  return { max: MAX_MEMBERS, members: rows.map((u) => toApi(u, currentUserId)) };
}

/** Charge un membre du restaurant courant : un id d'un autre restaurant donne 404 (isolation). */
async function member(restaurantId, id) {
  const u = await queryOne(`SELECT ${COLS} FROM users WHERE id = ? AND restaurant_id = ?`, [id, restaurantId]);
  if (!u) throw notFound('Membre introuvable.');
  return u;
}

function assertEditable(target, actor) {
  if (target.role === 'owner') throw forbidden('Le compte propriétaire ne peut pas être modifié ici.');
  if (target.id === actor.id) throw forbidden('Vous ne pouvez pas modifier votre propre compte depuis cette page.');
}

export async function create(restaurantId, actor, { name, email, phone, role, password }, ip) {
  const count = await queryOne('SELECT COUNT(*) AS n FROM users WHERE restaurant_id = ?', [restaurantId]);
  if (Number(count.n) >= MAX_MEMBERS) throw badRequest(`Maximum ${MAX_MEMBERS} membres par restaurant.`);
  if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) {
    throw conflict('Un compte existe déjà avec cet email.');
  }
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const res = await query(
    'INSERT INTO users (restaurant_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [restaurantId, name, email, phone ?? null, hash, role]
  );
  await logActivity({ restaurantId, userId: actor.id, action: 'team.created', entity: 'user', entityId: res.insertId, meta: { role }, ip });
  return toApi(await member(restaurantId, res.insertId), actor.id);
}

export async function update(restaurantId, actor, id, { name, phone, role, isActive }, ip) {
  const target = await member(restaurantId, id);
  assertEditable(target, actor);
  const sets = []; const params = []; let revoke = false;
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
  if (role !== undefined && role !== target.role) { sets.push('role = ?'); params.push(role); revoke = true; }
  if (isActive !== undefined && Number(isActive) !== Number(target.is_active)) { sets.push('is_active = ?'); params.push(Number(isActive)); if (!isActive) revoke = true; }
  if (revoke) sets.push('token_version = token_version + 1'); // le rôle/l'accès change : les sessions ouvertes sont coupées
  if (sets.length) await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ?`, [...params, id, restaurantId]);
  await logActivity({ restaurantId, userId: actor.id, action: 'team.updated', entity: 'user', entityId: id, meta: { role, isActive }, ip });
  return toApi(await member(restaurantId, id), actor.id);
}

export async function setPassword(restaurantId, actor, id, password, ip) {
  const target = await member(restaurantId, id);
  assertEditable(target, actor);
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ? AND restaurant_id = ?', [hash, id, restaurantId]);
  await logActivity({ restaurantId, userId: actor.id, action: 'team.password_reset', entity: 'user', entityId: id, ip });
}

export async function remove(restaurantId, actor, id, ip) {
  const target = await member(restaurantId, id);
  assertEditable(target, actor);
  await query('DELETE FROM users WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  await logActivity({ restaurantId, userId: actor.id, action: 'team.removed', entity: 'user', entityId: id, ip });
}
