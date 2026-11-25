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

async function admin(tag = 'a') {
  const bcrypt = (await import('bcrypt')).default;
  const email = `test-admin-${tag}-${crypto.randomBytes(3).toString('hex')}@example.com`;
  await query(`INSERT INTO users (restaurant_id, name, email, password_hash, role) VALUES (NULL, 'Super Admin', ?, ?, 'super_admin')`, [email, await bcrypt.hash(PASSWORD, 4)]);
  return (await api('POST', '/auth/login', { body: { email, password: PASSWORD } })).body.token;
}
const view = (rid, when, table = null, hash = crypto.randomBytes(8).toString('hex')) =>
  query('INSERT INTO menu_views (restaurant_id, viewed_at, table_label, visitor_hash) VALUES (?, ?, ?, ?)', [rid, when, table, hash]);

test('statistiques : séries, heures, tables, rôles et isolation', async () => {
  const a = await signup('p7a'); const b = await signup('p7b');
  const editor = await addStaff(a.rid, 'editor', 'p7');
  const manager = await addStaff(a.rid, 'manager', 'p7');
  const now = Date.now();
  await view(a.rid, new Date(now), 'T1'); await view(a.rid, new Date(now), 'T1'); await view(a.rid, new Date(now - 2 * 86_400_000), null);
  await view(a.rid, new Date(now - 10 * 86_400_000), 'T2');
  await view(b.rid, new Date(now), 'TB');

  const r = await api('GET', '/restaurant/stats?days=7', { token: a.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.series.length, 7);
  assert.equal(r.body.totals.views, 3, 'la vue de il y a 10 jours est hors période, celle de l’autre restaurant exclue');
  assert.equal(r.body.hours.length, 24);
  assert.equal(r.body.hours.reduce((s, h) => s + h.views, 0), 3);
  assert.deepEqual(r.body.tables, [{ table: 'T1', views: 2 }]);
  assert.equal(r.body.withoutTable, 1);
  assert.notEqual(r.body.totals.peakHour, null);
  const r30 = await api('GET', '/restaurant/stats?days=30', { token: a.token });
  assert.equal(r30.body.totals.views, 4);
  assert.equal(r30.body.series.length, 30);
  assert.equal((await api('GET', '/restaurant/stats?days=30', { token: b.token })).body.totals.views, 1);
  assert.equal((await api('GET', '/restaurant/stats?days=5', { token: a.token })).status, 400);
  assert.equal((await api('GET', '/restaurant/stats', { token: editor })).status, 403, 'editor refusé');
  assert.equal((await api('GET', '/restaurant/stats', { token: manager })).status, 200);
  assert.equal((await api('GET', '/restaurant/stats', {})).status, 401);
});

test('statistiques : une vraie visite publique est comptée avec l’heure UTC', async () => {
  const a = await signup('p7c');
  await api('PUT', '/restaurant/menu', { token: a.token, body: { isPublished: true } });
  assert.equal((await fetch(`${base}/api/public/menu/${a.slug}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 200);
  const s = (await api('GET', '/restaurant/stats?days=7', { token: a.token })).body;
  assert.equal(s.totals.views, 1);
  assert.equal(s.series.at(-1).views, 1, 'comptée dans le dernier jour local');
});

test('équipe : propriétaire seul, création, rôles, désactivation, isolation', async () => {
  const a = await signup('p7d'); const b = await signup('p7e');
  const manager = await addStaff(a.rid, 'manager', 'p7d');
  assert.equal((await api('GET', '/restaurant/team', { token: manager })).status, 403, 'manager refusé');
  assert.equal((await api('GET', '/restaurant/team', {})).status, 401);

  const list0 = (await api('GET', '/restaurant/team', { token: a.token })).body;
  assert.equal(list0.members[0].role, 'owner');
  assert.ok(list0.members[0].isMe);
  assert.ok(!JSON.stringify(list0).includes('password'), 'aucun hachage exposé');

  const email = `test-new-${crypto.randomBytes(3).toString('hex')}@example.com`;
  const bad = await api('POST', '/restaurant/team', { token: a.token, body: { name: 'Sami', email, role: 'owner', password: PASSWORD } });
  assert.equal(bad.status, 400, 'on ne crée pas de propriétaire');
  assert.equal((await api('POST', '/restaurant/team', { token: a.token, body: { name: 'Sami', email, role: 'editor', password: 'court1' } })).status, 400);
  assert.equal((await api('POST', '/restaurant/team', { token: a.token, body: { name: 'Sami', email, role: 'editor', password: PASSWORD, restaurantId: b.rid } })).status, 201, 'champ inconnu ignoré');
  assert.equal((await api('POST', '/restaurant/team', { token: a.token, body: { name: 'Sami 2', email, role: 'editor', password: PASSWORD } })).status, 409, 'email déjà utilisé');

  const m = (await api('GET', '/restaurant/team', { token: a.token })).body.members.find((x) => x.email === email);
  assert.equal(m.role, 'editor');
  const row = await query('SELECT restaurant_id FROM users WHERE id = ?', [m.id]);
  assert.equal(row[0].restaurant_id, a.rid, 'rattaché au restaurant du propriétaire, jamais à celui du corps');

  const login = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(login.status, 200);
  const staff = login.body.token;
  assert.equal((await api('GET', '/restaurant/categories', { token: staff })).status, 200);

  // changement de rôle : l'ancienne session est coupée
  assert.equal((await api('PATCH', `/restaurant/team/${m.id}`, { token: a.token, body: { role: 'manager' } })).body.role, 'manager');
  assert.equal((await api('GET', '/restaurant/categories', { token: staff })).status, 401);
  const staff2 = (await api('POST', '/auth/login', { body: { email, password: PASSWORD } })).body.token;

  // désactivation : connexion refusée
  assert.equal((await api('PATCH', `/restaurant/team/${m.id}`, { token: a.token, body: { isActive: false } })).body.isActive, false);
  assert.equal((await api('GET', '/restaurant/categories', { token: staff2 })).status, 401);
  assert.notEqual((await api('POST', '/auth/login', { body: { email, password: PASSWORD } })).status, 200);
  await api('PATCH', `/restaurant/team/${m.id}`, { token: a.token, body: { isActive: true } });

  // mot de passe réinitialisé par le propriétaire
  assert.equal((await api('POST', `/restaurant/team/${m.id}/password`, { token: a.token, body: { password: 'NouveauMdp2026' } })).status, 204);
  assert.notEqual((await api('POST', '/auth/login', { body: { email, password: PASSWORD } })).status, 200);
  assert.equal((await api('POST', '/auth/login', { body: { email, password: 'NouveauMdp2026' } })).status, 200);

  // protections : propriétaire et soi-même intouchables ; autre restaurant = 404
  const ownerId = list0.members[0].id;
  assert.equal((await api('PATCH', `/restaurant/team/${ownerId}`, { token: a.token, body: { isActive: false } })).status, 403);
  assert.equal((await api('DELETE', `/restaurant/team/${ownerId}`, { token: a.token })).status, 403);
  assert.equal((await api('PATCH', `/restaurant/team/${m.id}`, { token: b.token, body: { role: 'editor' } })).status, 404);
  assert.equal((await api('DELETE', `/restaurant/team/${m.id}`, { token: b.token })).status, 404);
  assert.equal((await api('POST', `/restaurant/team/${m.id}/password`, { token: b.token, body: { password: PASSWORD } })).status, 404);
  assert.equal((await api('PATCH', `/restaurant/team/${m.id}`, { token: a.token, body: {} })).status, 400);

  assert.equal((await api('DELETE', `/restaurant/team/${m.id}`, { token: a.token })).status, 204);
  assert.equal((await api('GET', '/restaurant/team', { token: a.token })).body.members.some((x) => x.id === m.id), false);
});

test('équipe : limite de membres et abonnement expiré (écriture bloquée, lecture ouverte)', async () => {
  const a = await signup('p7f');
  for (let i = 0; i < 9; i++) {
    const r = await api('POST', '/restaurant/team', { token: a.token, body: { name: `Membre ${i}`, email: `test-lim${i}-${crypto.randomBytes(3).toString('hex')}@example.com`, role: 'editor', password: PASSWORD } });
    assert.equal(r.status, 201);
  }
  assert.equal((await api('POST', '/restaurant/team', { token: a.token, body: { name: 'Trop', email: `test-trop-${crypto.randomBytes(3).toString('hex')}@example.com`, role: 'editor', password: PASSWORD } })).status, 400, '10 membres maximum');
  await query(`UPDATE subscriptions SET status = 'trial', starts_at = NOW() - INTERVAL 5 DAY, ends_at = NOW() - INTERVAL 1 HOUR WHERE restaurant_id = ?`, [a.rid]);
  assert.equal((await api('GET', '/restaurant/team', { token: a.token })).status, 200);
  assert.equal((await api('GET', '/restaurant/stats', { token: a.token })).status, 200);
});

test('coordonnées de paiement : Super Admin écrit, tous les rôles du restaurant lisent', async () => {
  const a = await signup('p7g'); const adm = await admin('p7');
  const editor = await addStaff(a.rid, 'editor', 'p7g');
  assert.equal((await api('PUT', '/admin/payment-info', { token: a.token, body: { rib: '12345678901234567890' } })).status, 403);
  assert.equal((await api('GET', '/admin/payment-info', { token: a.token })).status, 403);
  assert.equal((await api('PUT', '/admin/payment-info', { token: adm, body: { rib: 'xx' } })).status, 400);
  assert.equal((await api('PUT', '/admin/payment-info', { token: adm, body: { d17: 'abc' } })).status, 400);
  assert.equal((await api('PUT', '/admin/payment-info', { token: adm, body: { contactEmail: 'pas-un-email' } })).status, 400);
  const ok = await api('PUT', '/admin/payment-info', { token: adm, body: { bankName: 'BIAT', accountHolder: 'MH Digital Solution', rib: '08 006 0123456789012 34', d17: '+216 22 123 456', instructions: 'Envoyez le reçu par WhatsApp.', evil: 'x' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.bankName, 'BIAT');
  assert.equal(ok.body.flouci, null);
  assert.equal(ok.body.evil, undefined);
  for (const t of [a.token, editor]) {
    const g = await api('GET', '/restaurant/payment-info', { token: t });
    assert.equal(g.status, 200);
    assert.equal(g.body.rib, '08 006 0123456789012 34');
  }
  assert.equal((await api('GET', '/restaurant/payment-info', {})).status, 401);
  assert.equal((await api('GET', '/restaurant/payment-info', { token: adm })).status, 403, 'pas de contexte restaurant pour le Super Admin');
});
