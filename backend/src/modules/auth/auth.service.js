import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { query, queryOne, transaction } from '../../config/db.js';
import { conflict, unauthorized, badRequest, forbidden } from '../../utils/errors.js';
import { uniqueSlug } from '../../utils/slug.js';
import { logActivity } from '../../utils/activity.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../../utils/mailer.js';
import { signToken, ROLES } from '../../middlewares/auth.js';
import { getAccessState } from '../subscriptions/subscription.service.js';

const BCRYPT_COST = 12;
const RESET_TTL_MS = 60 * 60_000;
// Hash factice : on compare toujours un hash, même pour un email inconnu (temps de réponse homogène)
const DUMMY_HASH = bcrypt.hashSync('mh-menu-dummy-password', BCRYPT_COST);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone ?? null, role: u.role, restaurantId: u.restaurant_id ?? u.restaurantId ?? null };
}

export async function registerRestaurant({ restaurantName, ownerName, email, phone, password }, ip) {
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) throw conflict('Un compte existe déjà avec cet email.');

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const now = new Date();
  const trialEnd = new Date(now.getTime() + env.trialDays * 86_400_000);

  const created = await transaction(async (conn) => {
    const slug = await uniqueSlug(restaurantName, async (s) => !!(await queryOne('SELECT id FROM restaurants WHERE slug = ?', [s], conn)));

    const r = await query('INSERT INTO restaurants (name, slug) VALUES (?, ?)', [restaurantName, slug], conn);
    const restaurantId = r.insertId;

    const u = await query(
      `INSERT INTO users (restaurant_id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, 'owner')`,
      [restaurantId, ownerName, email, phone, passwordHash],
      conn
    );
    const userId = u.insertId;

    await query('INSERT INTO restaurant_settings (restaurant_id, phone) VALUES (?, ?)', [restaurantId, phone], conn);
    await query('INSERT INTO menus (restaurant_id) VALUES (?)', [restaurantId], conn);
    // QR Code principal : l'URL est basée sur le slug, donc stable même si produits et prix changent
    await query('INSERT INTO qr_codes (restaurant_id, table_label) VALUES (?, NULL)', [restaurantId], conn);

    const plan = await queryOne(`SELECT id FROM subscription_plans WHERE code = 'trial'`, [], conn);
    await query(
      `INSERT INTO subscriptions (restaurant_id, plan_id, status, starts_at, ends_at) VALUES (?, ?, 'trial', ?, ?)`,
      [restaurantId, plan.id, now, trialEnd],
      conn
    );

    await logActivity({ restaurantId, userId, action: 'restaurant.registered', entity: 'restaurant', entityId: restaurantId, ip }, conn);
    return { restaurantId, userId, slug };
  });

  const user = await queryOne('SELECT * FROM users WHERE id = ?', [created.userId]);

  sendWelcomeEmail({
    to: email,
    name: ownerName,
    restaurantName,
    trialDays: env.trialDays,
    dashboardUrl: `${env.clientUrl}/dashboard`,
  }).catch((err) => console.error('[mailer] email de bienvenue non envoyé :', err.message));

  return {
    token: signToken(user),
    user: publicUser(user),
    restaurant: { id: created.restaurantId, name: restaurantName, slug: created.slug },
    subscription: await getAccessState(created.restaurantId),
  };
}

export async function login({ email, password }, ip) {
  const user = await queryOne(
    `SELECT u.*, r.status AS restaurant_status FROM users u LEFT JOIN restaurants r ON r.id = u.restaurant_id WHERE u.email = ?`,
    [email]
  );

  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok || !user.is_active) throw unauthorized('Email ou mot de passe incorrect.');

  if (user.role !== ROLES.SUPER_ADMIN && user.restaurant_status !== 'active') {
    throw forbidden('Ce compte est suspendu. Contactez MH Digital Solution.', 'ACCOUNT_SUSPENDED');
  }

  await query('UPDATE users SET last_login_at = ? WHERE id = ?', [new Date(), user.id]);
  await logActivity({ restaurantId: user.restaurant_id, userId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, ip });

  return { token: signToken(user), ...(await getProfile(user.id)) };
}

export async function getProfile(userId) {
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) throw unauthorized();

  let restaurant = null;
  let subscription = null;
  if (user.restaurant_id) {
    restaurant = await queryOne('SELECT id, name, slug, status FROM restaurants WHERE id = ?', [user.restaurant_id]);
    subscription = await getAccessState(user.restaurant_id);
  }
  return { user: publicUser(user), restaurant, subscription };
}

/** Invalide tous les jetons existants de l'utilisateur. */
export async function logout(userId, restaurantId, ip) {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
  await logActivity({ restaurantId, userId, action: 'auth.logout', entity: 'user', entityId: userId, ip });
}

/** Réponse identique que l'email existe ou non (pas d'énumération de comptes). */
export async function requestPasswordReset({ email }, ip) {
  const user = await queryOne('SELECT id, name, email, restaurant_id FROM users WHERE email = ? AND is_active = 1', [email]);
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  await transaction(async (conn) => {
    await query('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL', [user.id], conn);
    await query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip) VALUES (?, ?, ?, ?)',
      [user.id, sha256(token), new Date(Date.now() + RESET_TTL_MS), ip ?? null],
      conn
    );
  });
  await logActivity({ restaurantId: user.restaurant_id, userId: user.id, action: 'auth.password_reset_requested', entity: 'user', entityId: user.id, ip });

  sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl: `${env.clientUrl}/reinitialiser-mot-de-passe?token=${token}`,
  }).catch((err) => console.error('[mailer] email de réinitialisation non envoyé :', err.message));
}

export async function resetPassword({ token, password }, ip) {
  const row = await queryOne(
    `SELECT pr.id, pr.user_id, u.restaurant_id
       FROM password_resets pr JOIN users u ON u.id = pr.user_id
      WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ?`,
    [sha256(token), new Date()]
  );
  if (!row) throw badRequest('Ce lien est invalide ou a expiré. Refaites une demande de réinitialisation.');

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await transaction(async (conn) => {
    // Le UPDATE conditionnel garantit qu'un lien ne sert qu'une fois, même en cas de requêtes simultanées
    const used = await query('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL', [new Date(), row.id], conn);
    if (used.affectedRows !== 1) throw badRequest('Ce lien est invalide ou a expiré. Refaites une demande de réinitialisation.');
    await query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [passwordHash, row.user_id], conn);
    await logActivity({ restaurantId: row.restaurant_id, userId: row.user_id, action: 'auth.password_reset_done', entity: 'user', entityId: row.user_id, ip }, conn);
  });
}

export async function updateProfile(userId, restaurantId, { name, phone }, ip) {
  await query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone ?? null, userId]);
  await logActivity({ restaurantId, userId, action: 'profile.updated', entity: 'user', entityId: userId, ip });
  return getProfile(userId);
}

/** Change le mot de passe, révoque les autres sessions et renvoie un nouveau jeton pour la session courante. */
export async function changePassword(userId, restaurantId, { currentPassword, password }, ip) {
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw badRequest('Mot de passe actuel incorrect.', { currentPassword: 'Mot de passe actuel incorrect.' });
  }
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, userId]);
  await logActivity({ restaurantId, userId, action: 'auth.password_changed', entity: 'user', entityId: userId, ip });
  const fresh = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  return { token: signToken(fresh) };
}
