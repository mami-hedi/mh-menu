import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool, query } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { setStorage, ownsPublicId } from '../src/services/storage.js';

// Stockage simulé : aucun appel réseau, on vérifie ce que l'application demande de stocker / supprimer.
const fake = {
  configured: true, uploads: [], destroyed: [], copies: [], n: 0,
  async upload(_buf, { folder }) { const id = `${folder}/img${++this.n}`; this.uploads.push(id); return { url: `https://cdn.test/${id}.png`, publicId: id }; },
  async destroy(id) { this.destroyed.push(id); },
  async copy(_url, { folder }) { const id = `${folder}/copy${++this.n}`; this.copies.push(id); return { url: `https://cdn.test/${id}.png`, publicId: id }; },
};
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), crypto.randomBytes(64)]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server, base;
const PASSWORD = 'Motdepasse123';
const mk = (tag) => ({
  restaurantName: `Pizzeria Test ${tag}`, ownerName: `Owner ${tag}`, email: `test-${tag}-${crypto.randomBytes(3).toString('hex')}@example.com`,
  phone: '+216 22 123 456', password: PASSWORD, confirmPassword: PASSWORD,
});

async function api(method, path, { body, token, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + '/api' + path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const imageForm = (field, parts) => {
  const f = new FormData();
  for (const [buf, name, type] of parts) f.append(field, new Blob([buf], { type }), name);
  return f;
};
async function signup(tag) {
  const r = await api('POST', '/auth/register', { body: mk(tag) });
  assert.equal(r.status, 201);
  return { token: r.body.token, rid: r.body.restaurant.id, user: r.body.user, slug: r.body.restaurant.slug };
}
async function addStaff(rid, role, tag) {
  const bcrypt = (await import('bcrypt')).default;
  const email = `test-${role}-${tag}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  await query(`INSERT INTO users (restaurant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`, [rid, `${role} ${tag}`, email, await bcrypt.hash(PASSWORD, 4), role]);
  const l = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(l.status, 200);
  return l.body.token;
}
const cat = async (t, name = 'Pizzas') => (await api('POST', '/restaurant/categories', { token: t, body: { name } })).body;
const prod = async (t, categoryId, extra = {}) => (await api('POST', '/restaurant/products', { token: t, body: { categoryId, name: 'Margherita', price: 12, ...extra } })).body;

async function cleanup() {
  await query(`DELETE FROM restaurants WHERE name LIKE 'Pizzeria Test %'`);
  await query(`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);
}
before(async () => {
  await cleanup();
  setStorage(fake);
  await new Promise((r) => (server = createApp().listen(0, r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await cleanup(); await new Promise((r) => server.close(r)); await pool.end(); });

const pub = (slug, qs = '') => api('GET', `/public/menu/${slug}${qs}`);

async function seed(tag) {
  const a = await signup(tag);
  const pizzas = await cat(a.token, 'Pizzas');
  const empty = await cat(a.token, 'Vide');
  const hidden = await cat(a.token, 'Cachée');
  await api('PATCH', `/restaurant/categories/${hidden.id}`, { token: a.token, body: { isActive: false } });
  const margh = await prod(a.token, pizzas.id, { name: 'Margherita', price: 12, isPopular: true,
    variants: [{ name: 'Petite', priceDelta: 0, isDefault: true }, { name: 'Grande', priceDelta: 4 }], extras: [{ name: 'Fromage', price: 1.5 }] });
  const promo = await prod(a.token, pizzas.id, { name: 'Reine', price: 15, promoPrice: 11.5, isPromo: true });
  const off = await prod(a.token, pizzas.id, { name: 'Épuisée', price: 9 });
  await api('PATCH', `/restaurant/products/${off.id}`, { token: a.token, body: { isAvailable: false } });
  const inactive = await prod(a.token, pizzas.id, { name: 'Brouillon', price: 5 });
  await api('PATCH', `/restaurant/products/${inactive.id}`, { token: a.token, body: { isActive: false } });
  await prod(a.token, hidden.id, { name: 'Dans catégorie cachée', price: 3 });
  return { ...a, pizzas, empty, margh, promo };
}

test('menu public : contenu visible, masquage, prix promo, aucune donnée interne', async () => {
  const a = await seed('p1');
  const r = await pub(a.slug);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.categories.map((c) => c.name), ['Pizzas'], 'catégories vides/inactives masquées');
  const names = r.body.categories[0].products.map((p) => p.name);
  assert.deepEqual(names, ['Margherita', 'Reine', 'Épuisée'], 'produit inactif masqué, indisponible conservé');
  const [m, reine, off] = r.body.categories[0].products;
  assert.equal(m.variants.length, 2);
  assert.equal(m.extras[0].name, 'Fromage');
  assert.equal(m.isPopular, true);
  assert.equal(Number(reine.finalPrice), 11.5);
  assert.equal(Number(reine.promoPrice), 11.5);
  assert.equal(m.promoPrice, null);
  assert.equal(off.isAvailable, false);
  const raw = JSON.stringify(r.body);
  for (const leak of ['restaurant_id', 'restaurantId', 'email', 'password', 'token_version', 'public_id', 'publicId']) assert.ok(!raw.includes(leak), `fuite : ${leak}`);
  assert.equal(r.body.menu.cartEnabled, true);
  assert.equal((await pub('inconnu-xyz')).status, 404);
  assert.equal((await pub('SLUG%20BAD')).status, 400);
});

test('menu public : réglages (modèle, panier, populaires) pris en compte', async () => {
  const a = await seed('p2');
  const put = await api('PUT', '/restaurant/menu', { token: a.token, body: { template: 'modern', cartEnabled: false, showPopular: false } });
  assert.equal(put.status, 200);
  assert.equal(put.body.template, 'modern');
  const r = await pub(a.slug);
  assert.equal(r.body.menu.template, 'modern');
  assert.equal(r.body.menu.cartEnabled, false);
  assert.equal(r.body.categories[0].products[0].isPopular, false);
  assert.equal((await api('PUT', '/restaurant/menu', { token: a.token, body: { template: 'evil' } })).status, 400);
});

test('menu public : indisponible si non publié, suspendu ou abonnement expiré', async () => {
  const a = await seed('p3');
  assert.equal((await api('PUT', '/restaurant/menu', { token: a.token, body: { isPublished: false } })).status, 200);
  let r = await pub(a.slug);
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'MENU_UNAVAILABLE');
  await api('PUT', '/restaurant/menu', { token: a.token, body: { isPublished: true } });
  assert.equal((await pub(a.slug)).status, 200);

  await query(`UPDATE subscriptions SET starts_at = NOW() - INTERVAL 5 DAY, ends_at = NOW() - INTERVAL 1 HOUR WHERE restaurant_id = ?`, [a.rid]);
  assert.equal((await pub(a.slug)).status, 403, 'abonnement expiré');
  await sleep(150); // laisse finir la synchronisation asynchrone du statut « expired »
  await query(`UPDATE subscriptions SET starts_at = NOW(), ends_at = NOW() + INTERVAL 2 DAY, status = 'trial' WHERE restaurant_id = ?`, [a.rid]);
  assert.equal((await pub(a.slug)).status, 200);
  await query(`UPDATE restaurants SET status = 'suspended' WHERE id = ?`, [a.rid]);
  assert.equal((await pub(a.slug)).status, 403, 'restaurant suspendu');
});

test('QR Codes : tables, doublons, série, suppression, URL principale stable', async () => {
  const a = await signup('q1');
  const l0 = await api('GET', '/restaurant/qrcodes', { token: a.token });
  assert.equal(l0.body.slug, a.slug);
  assert.deepEqual(l0.body.tables, []);
  assert.equal((await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: 'Terrasse 1' } })).status, 201);
  assert.equal((await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: 'terrasse 1' } })).status, 409, 'doublon insensible à la casse');
  assert.equal((await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: '   ' } })).status, 400);
  assert.equal((await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: 'x'.repeat(41) } })).status, 400);
  const bulk = await api('POST', '/restaurant/qrcodes/bulk', { token: a.token, body: { from: 1, to: 5 } });
  assert.equal(bulk.status, 201);
  assert.equal(bulk.body.created, 5);
  assert.equal((await api('POST', '/restaurant/qrcodes/bulk', { token: a.token, body: { from: 3, to: 7 } })).body.created, 2, 'tables existantes ignorées');
  assert.equal((await api('POST', '/restaurant/qrcodes/bulk', { token: a.token, body: { from: 5, to: 1 } })).status, 400);
  assert.equal((await api('POST', '/restaurant/qrcodes/bulk', { token: a.token, body: { from: 1, to: 500 } })).status, 400);
  const list = (await api('GET', '/restaurant/qrcodes', { token: a.token })).body.tables;
  assert.equal(list.length, 8);
  assert.equal((await api('DELETE', `/restaurant/qrcodes/${list[0].id}`, { token: a.token })).status, 200);
  assert.equal((await api('DELETE', `/restaurant/qrcodes/${list[0].id}`, { token: a.token })).status, 404);
  // L'URL publique ne dépend pas des QR Codes ni du nom du restaurant
  await api('PUT', '/restaurant/settings', { token: a.token, body: { name: 'Nouveau nom' } });
  assert.equal((await api('GET', '/restaurant/qrcodes', { token: a.token })).body.slug, a.slug);
});

test('QR Codes et menu : isolation, rôles et abonnement expiré', async () => {
  const a = await signup('q2');
  const b = await signup('q3');
  const t = (await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: 'A1' } })).body.tables[0];
  assert.equal((await api('DELETE', `/restaurant/qrcodes/${t.id}`, { token: b.token })).status, 404, 'B ne peut pas supprimer le QR de A');
  assert.equal((await api('GET', '/restaurant/qrcodes', { token: b.token })).body.tables.length, 0);
  assert.equal((await api('GET', '/restaurant/qrcodes', {})).status, 401);
  assert.equal((await api('GET', '/restaurant/menu', {})).status, 401);

  const editor = await addStaff(a.rid, 'editor', 'q2');
  assert.equal((await api('GET', '/restaurant/qrcodes', { token: editor })).status, 200, 'lecture autorisée');
  assert.equal((await api('POST', '/restaurant/qrcodes', { token: editor, body: { tableLabel: 'E1' } })).status, 403);
  assert.equal((await api('DELETE', `/restaurant/qrcodes/${t.id}`, { token: editor })).status, 403);
  assert.equal((await api('GET', '/restaurant/menu', { token: editor })).status, 403);
  assert.equal((await api('PUT', '/restaurant/menu', { token: editor, body: { cartEnabled: false } })).status, 403);

  await query(`UPDATE subscriptions SET starts_at = NOW() - INTERVAL 5 DAY, ends_at = NOW() - INTERVAL 1 HOUR WHERE restaurant_id = ?`, [a.rid]);
  assert.equal((await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: 'A2' } })).status, 403);
  assert.equal((await api('PUT', '/restaurant/menu', { token: a.token, body: { cartEnabled: false } })).status, 403);
  assert.equal((await api('GET', '/restaurant/qrcodes', { token: a.token })).status, 200);
});

test('consultations : comptées une fois par visiteur, table valide seulement, visibles au tableau de bord', async () => {
  const a = await seed('v1');
  await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: '7' } });
  const v1 = await api('POST', `/public/menu/${a.slug}/view?table=7`);
  assert.equal(v1.body.counted, true);
  assert.equal((await api('POST', `/public/menu/${a.slug}/view?table=7`)).body.counted, false, 'même visiteur : pas de doublon');
  const rows = await query('SELECT table_label, visitor_hash FROM menu_views WHERE restaurant_id = ?', [a.rid]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].table_label, '7');
  assert.match(rows[0].visitor_hash, /^[0-9a-f]{64}$/);
  // Un visiteur différent est compté ; une table inconnue est ignorée (pas enregistrée)
  await query('DELETE FROM menu_views WHERE restaurant_id = ?', [a.rid]);
  const res = await fetch(`${base}/api/public/menu/${a.slug}/view?table=inconnue`, { method: 'POST', headers: { 'user-agent': 'autre-navigateur' } });
  assert.equal((await res.json()).counted, true);
  assert.equal((await query('SELECT table_label FROM menu_views WHERE restaurant_id = ?', [a.rid]))[0].table_label, null);
  const dash = await api('GET', '/restaurant/dashboard', { token: a.token });
  assert.equal(dash.body.views.total, 1);
  assert.equal((await api('POST', '/public/menu/inconnu-xyz/view')).status, 404);
  const t = await pub(a.slug, '?table=7');
  assert.equal(t.body.table, '7');
  assert.equal((await pub(a.slug, '?table=zzz')).body.table, null);
});
