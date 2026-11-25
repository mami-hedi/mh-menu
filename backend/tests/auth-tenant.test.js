import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { pool, query } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { authenticate, tenant, requireActiveSubscription } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

let server, base;
const PASSWORD = 'Motdepasse123';
const mk = (tag) => ({
  restaurantName: `Pizzeria Test ${tag}`,
  ownerName: `Owner ${tag}`,
  email: `test-${tag}-${crypto.randomBytes(3).toString('hex')}@example.com`,
  phone: '+216 22 123 456',
  password: PASSWORD,
  confirmPassword: PASSWORD,
});

async function api(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function cleanup() {
  await query(`DELETE FROM restaurants WHERE name LIKE 'Pizzeria Test %'`);
  await query(`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);
}

before(async () => {
  await cleanup();
  const app = createApp();
  // Route sonde : même chaîne que les futures routes d'écriture du restaurant
  const probe = express.Router();
  probe.use(authenticate, tenant, requireActiveSubscription);
  probe.post('/write', (req, res) => res.json({ restaurantId: req.restaurantId }));
  const wrapper = express();
  wrapper.use(express.json());
  wrapper.use('/probe', probe);
  wrapper.use(errorHandler);
  wrapper.use(app);
  await new Promise((r) => (server = wrapper.listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await cleanup();
  await new Promise((r) => server.close(r));
  await pool.end();
});

test('inscription : crée restaurant, propriétaire, essai de 3 jours et QR principal', async () => {
  const data = mk('reg');
  const r = await api('POST', '/api/auth/register', { body: data });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(r.body.user.role, 'owner');
  assert.equal(r.body.subscription.status, 'trial');
  assert.equal(r.body.subscription.daysLeft, 3);
  assert.equal(r.body.subscription.canWrite, true);
  assert.match(r.body.restaurant.slug, /^pizzeria-test-reg/);
  assert.equal(JSON.stringify(r.body).includes('password'), false, 'aucun hash de mot de passe dans la réponse');

  const [{ n }] = await query('SELECT COUNT(*) AS n FROM qr_codes WHERE restaurant_id = ?', [r.body.restaurant.id]);
  assert.equal(Number(n), 1);
  const [u] = await query('SELECT password_hash FROM users WHERE email = ?', [data.email]);
  assert.match(u.password_hash, /^\$2[aby]\$12\$/, 'mot de passe haché avec bcrypt');
});

test('inscription : validation et doublons', async () => {
  const bad = await api('POST', '/api/auth/register', { body: { ...mk('bad'), confirmPassword: 'autre' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.details.confirmPassword);

  const weak = await api('POST', '/api/auth/register', { body: { ...mk('weak'), password: 'court1', confirmPassword: 'court1' } });
  assert.equal(weak.status, 400);

  const data = mk('dup');
  assert.equal((await api('POST', '/api/auth/register', { body: data })).status, 201);
  const again = await api('POST', '/api/auth/register', { body: { ...data, restaurantName: 'Pizzeria Test dup2' } });
  assert.equal(again.status, 409);
});

test('slugs uniques pour deux restaurants au même nom', async () => {
  const a = await api('POST', '/api/auth/register', { body: { ...mk('s1'), restaurantName: 'Pizzeria Test Slug' } });
  const b = await api('POST', '/api/auth/register', { body: { ...mk('s2'), restaurantName: 'Pizzeria Test Slug' } });
  assert.notEqual(a.body.restaurant.slug, b.body.restaurant.slug);
});

test('connexion, /me, déconnexion et révocation du jeton', async () => {
  const data = mk('login');
  await api('POST', '/api/auth/register', { body: data });

  const bad = await api('POST', '/api/auth/login', { body: { email: data.email, password: 'MauvaisMdp123' } });
  assert.equal(bad.status, 401);
  const unknown = await api('POST', '/api/auth/login', { body: { email: 'inconnu@example.com', password: PASSWORD } });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error.message, bad.body.error.message, 'message identique : pas d\'énumération');

  const ok = await api('POST', '/api/auth/login', { body: { email: data.email, password: PASSWORD } });
  assert.equal(ok.status, 200);
  const me = await api('GET', '/api/auth/me', { token: ok.body.token });
  assert.equal(me.body.user.email, data.email);

  assert.equal((await api('GET', '/api/auth/me')).status, 401);
  assert.equal((await api('GET', '/api/auth/me', { token: 'n.importe.quoi' })).status, 401);

  assert.equal((await api('POST', '/api/auth/logout', { token: ok.body.token })).status, 204);
  assert.equal((await api('GET', '/api/auth/me', { token: ok.body.token })).status, 401, 'jeton révoqué après déconnexion');
});

test('jeton falsifié (rôle/restaurant modifiés) refusé', async () => {
  const a = await api('POST', '/api/auth/register', { body: mk('forge') });
  const [h, p, s] = a.body.token.split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  payload.role = 'super_admin';
  const forged = [h, Buffer.from(JSON.stringify(payload)).toString('base64url'), s].join('.');
  assert.equal((await api('GET', '/api/auth/me', { token: forged })).status, 401);
});

test('multi-tenant : le restaurant vient du compte, jamais de la requête', async () => {
  const a = await api('POST', '/api/auth/register', { body: mk('ta') });
  const b = await api('POST', '/api/auth/register', { body: mk('tb') });
  const w = await api('POST', '/probe/write', { token: a.body.token, body: { restaurantId: b.body.restaurant.id } });
  assert.equal(w.status, 200);
  assert.equal(w.body.restaurantId, a.body.restaurant.id, 'le restaurant_id du corps est ignoré');
  assert.notEqual(w.body.restaurantId, b.body.restaurant.id);
});

test('Super Admin : refusé sur l\'espace restaurant', async () => {
  const email = `test-sa-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const bcrypt = (await import('bcrypt')).default;
  await query(`INSERT INTO users (restaurant_id, name, email, password_hash, role) VALUES (NULL, 'SA', ?, ?, 'super_admin')`, [email, await bcrypt.hash(PASSWORD, 10)]);
  const l = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(l.status, 200);
  assert.equal(l.body.user.role, 'super_admin');
  assert.equal((await api('GET', '/api/restaurant/subscription', { token: l.body.token })).status, 403);
});

test('essai expiré : lecture autorisée, écriture bloquée, propriétaire garde l\'accès', async () => {
  const a = await api('POST', '/api/auth/register', { body: mk('exp') });
  assert.equal((await api('POST', '/probe/write', { token: a.body.token })).status, 200);

  await query(`UPDATE subscriptions SET starts_at = ?, ends_at = ? WHERE restaurant_id = ?`, [
    new Date(Date.now() - 5 * 86_400_000),
    new Date(Date.now() - 2 * 86_400_000),
    a.body.restaurant.id,
  ]);

  const sub = await api('GET', '/api/restaurant/subscription', { token: a.body.token });
  assert.equal(sub.status, 200);
  assert.equal(sub.body.status, 'expired');
  assert.equal(sub.body.daysLeft, 0);

  const w = await api('POST', '/probe/write', { token: a.body.token });
  assert.equal(w.status, 403);
  assert.equal(w.body.error.code, 'SUBSCRIPTION_REQUIRED');
  assert.equal((await api('GET', '/api/auth/me', { token: a.body.token })).status, 200);
});

test('restaurant suspendu : connexion et jetons existants refusés', async () => {
  const data = mk('susp');
  const a = await api('POST', '/api/auth/register', { body: data });
  await query(`UPDATE restaurants SET status = 'suspended' WHERE id = ?`, [a.body.restaurant.id]);
  assert.equal((await api('GET', '/api/auth/me', { token: a.body.token })).status, 403);
  const l = await api('POST', '/api/auth/login', { body: { email: data.email, password: PASSWORD } });
  assert.equal(l.status, 403);
  assert.equal(l.body.error.code, 'ACCOUNT_SUSPENDED');
});

test('mot de passe oublié : réponse neutre, lien à usage unique, anciens jetons révoqués', async () => {
  const data = mk('reset');
  const reg = await api('POST', '/api/auth/register', { body: data });

  const known = await api('POST', '/api/auth/forgot-password', { body: { email: data.email } });
  const unknown = await api('POST', '/api/auth/forgot-password', { body: { email: 'personne@example.com' } });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body);

  const [row] = await query(
    `SELECT pr.id FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = ? AND pr.used_at IS NULL`, [data.email]);
  assert.ok(row, 'un jeton de réinitialisation a été créé');

  // Le jeton en clair n'est jamais stocké : on le remplace par un jeton connu pour tester la consommation
  const token = crypto.randomBytes(32).toString('hex');
  await query('UPDATE password_resets SET token_hash = ? WHERE id = ?', [crypto.createHash('sha256').update(token).digest('hex'), row.id]);

  const NEW = 'NouveauMdp456';
  const ok = await api('POST', '/api/auth/reset-password', { body: { token, password: NEW, confirmPassword: NEW } });
  assert.equal(ok.status, 200);
  const reuse = await api('POST', '/api/auth/reset-password', { body: { token, password: 'Encore789012', confirmPassword: 'Encore789012' } });
  assert.equal(reuse.status, 400, 'lien à usage unique');

  assert.equal((await api('GET', '/api/auth/me', { token: reg.body.token })).status, 401, 'anciennes sessions révoquées');
  assert.equal((await api('POST', '/api/auth/login', { body: { email: data.email, password: PASSWORD } })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { body: { email: data.email, password: NEW } })).status, 200);

  await query('INSERT INTO password_resets (user_id, token_hash, expires_at) SELECT id, ?, ? FROM users WHERE email = ?', [
    crypto.createHash('sha256').update('b'.repeat(64)).digest('hex'), new Date(Date.now() - 1000), data.email]);
  const expired = await api('POST', '/api/auth/reset-password', { body: { token: 'b'.repeat(64), password: NEW, confirmPassword: NEW } });
  assert.equal(expired.status, 400, 'lien expiré refusé');
});

test('base de données : impossible de relier un produit à la catégorie d\'un autre restaurant', async () => {
  const a = await api('POST', '/api/auth/register', { body: mk('fka') });
  const b = await api('POST', '/api/auth/register', { body: mk('fkb') });
  const cat = await query(`INSERT INTO categories (restaurant_id, name) VALUES (?, 'Pizzas')`, [a.body.restaurant.id]);

  await assert.rejects(
    query(`INSERT INTO products (restaurant_id, category_id, name, price) VALUES (?, ?, 'Intrus', 10)`, [b.body.restaurant.id, cat.insertId]),
    /foreign key/i
  );
  const ok = await query(`INSERT INTO products (restaurant_id, category_id, name, price) VALUES (?, ?, 'Margherita', 10)`, [a.body.restaurant.id, cat.insertId]);
  await assert.rejects(
    query(`INSERT INTO product_variants (restaurant_id, product_id, name) VALUES (?, ?, 'Grande')`, [b.body.restaurant.id, ok.insertId]),
    /foreign key/i
  );
  await assert.rejects(
    query(`INSERT INTO products (restaurant_id, category_id, name, price, promo_price) VALUES (?, ?, 'Promo', 10, 12)`, [a.body.restaurant.id, cat.insertId]),
    /constraint/i,
    'le prix promo doit être inférieur au prix'
  );
});

test('dashboard : statistiques strictement limitées au restaurant connecté', async () => {
  const a = await api('POST', '/api/auth/register', { body: mk('da') });
  const b = await api('POST', '/api/auth/register', { body: mk('db') });
  const catA = await query(`INSERT INTO categories (restaurant_id, name) VALUES (?, 'Pizzas')`, [a.body.restaurant.id]);
  const catB = await query(`INSERT INTO categories (restaurant_id, name) VALUES (?, 'Burgers')`, [b.body.restaurant.id]);
  await query(`INSERT INTO categories (restaurant_id, name) VALUES (?, 'Desserts')`, [b.body.restaurant.id]);
  await query(`INSERT INTO products (restaurant_id, category_id, name, price, is_available) VALUES (?, ?, 'P1', 10, 1), (?, ?, 'P2', 12, 0)`,
    [a.body.restaurant.id, catA.insertId, a.body.restaurant.id, catA.insertId]);
  await query(`INSERT INTO products (restaurant_id, category_id, name, price) VALUES (?, ?, 'B1', 9)`, [b.body.restaurant.id, catB.insertId]);
  await query(`INSERT INTO menu_views (restaurant_id) VALUES (?), (?), (?)`, [a.body.restaurant.id, a.body.restaurant.id, b.body.restaurant.id]);

  const da = await api('GET', '/api/restaurant/dashboard', { token: a.body.token });
  assert.equal(da.status, 200);
  assert.deepEqual(da.body.products, { total: 2, available: 1, unavailable: 1 });
  assert.equal(da.body.categories, 1);
  assert.equal(da.body.views.total, 2);
  assert.equal(da.body.views.last7Days.length, 7);
  assert.equal(da.body.views.last7Days.reduce((s, d) => s + d.views, 0), 2);
  assert.equal(da.body.restaurant.id, a.body.restaurant.id);
  assert.ok(da.body.recentActivity.some((x) => x.action === 'restaurant.registered'));
  const flat = JSON.stringify(da.body);
  assert.equal(flat.includes('"ip"'), false, 'pas d\'IP dans le journal exposé');

  const db = await api('GET', '/api/restaurant/dashboard', { token: b.body.token });
  assert.deepEqual(db.body.products, { total: 1, available: 1, unavailable: 0 });
  assert.equal(db.body.categories, 2);

  assert.equal((await api('GET', '/api/restaurant/dashboard')).status, 401);
  const hist = await api('GET', '/api/restaurant/subscription/history', { token: a.body.token });
  assert.equal(hist.body.length, 1);
  assert.equal(hist.body[0].planCode, 'trial');
});

test('en-têtes de sécurité et routes inconnues', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(res.headers.get('x-content-type-options'));
  const nf = await api('GET', '/api/nimporte');
  assert.equal(nf.status, 404);
});
