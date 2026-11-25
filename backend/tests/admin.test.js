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
  const l = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(l.status, 200);
  return l.body.token;
}
const expire = (rid) => query(`UPDATE subscriptions SET status = 'trial', starts_at = NOW() - INTERVAL 5 DAY, ends_at = NOW() - INTERVAL 1 HOUR WHERE restaurant_id = ?`, [rid]);
const pay = { planCode: 'monthly', method: 'cash' };
const DAY = 86_400_000;

test('Super Admin : accès réservé, isolation des espaces', async () => {
  const a = await signup('s1');
  const adm = await admin();
  for (const path of ['/admin/stats', '/admin/restaurants', '/admin/payments', '/admin/tickets']) {
    assert.equal((await api('GET', path, { token: a.token })).status, 403, `propriétaire refusé sur ${path}`);
    assert.equal((await api('GET', path, {})).status, 401);
    assert.equal((await api('GET', path, { token: adm })).status, 200, path);
  }
  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: a.token, body: pay })).status, 403, 'auto-activation impossible');
  assert.equal((await api('GET', '/restaurant/categories', { token: adm })).status, 403, 'le Super Admin n’a pas de contexte restaurant');
});

test('activation manuelle : essai → actif, paiement enregistré, renouvellement cumulatif', async () => {
  const a = await signup('s2');
  const adm = await admin();
  assert.equal((await api('GET', '/restaurant/subscription', { token: a.token })).body.status, 'trial');

  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: adm, body: { planCode: 'trial', method: 'cash' } })).status, 400, 'offre non publique refusée');
  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: adm, body: { planCode: 'monthly', method: 'bitcoin' } })).status, 400);
  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: adm, body: { ...pay, paidAt: new Date(Date.now() + 3 * DAY).toISOString() } })).status, 400, 'paiement futur refusé');
  assert.equal((await api('POST', `/admin/restaurants/999999/activate`, { token: adm, body: pay })).status, 404);

  const r1 = await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: adm, body: { ...pay, reference: 'REC-001' } });
  assert.equal(r1.status, 200);
  const sub = (await api('GET', '/restaurant/subscription', { token: a.token })).body;
  assert.equal(sub.status, 'active');
  assert.equal(sub.planCode, 'monthly');
  assert.ok(sub.daysLeft >= 29 && sub.daysLeft <= 30);
  assert.equal(r1.body.payments.length, 1);
  assert.equal(r1.body.payments[0].amountDt, 29, 'montant par défaut = prix de l’offre');
  assert.equal(r1.body.payments[0].reference, 'REC-001');
  const end1 = new Date(sub.endsAt).getTime();

  // Renouvellement annuel : 365 jours ajoutés à la fin existante, même abonnement
  const r2 = await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: adm, body: { planCode: 'yearly', method: 'bank_transfer', amountDt: 290 } });
  assert.equal(r2.status, 200);
  const sub2 = (await api('GET', '/restaurant/subscription', { token: a.token })).body;
  assert.equal(Math.round((new Date(sub2.endsAt).getTime() - end1) / DAY), 365);
  assert.equal(sub2.subscriptionId, sub.subscriptionId);
  assert.equal(r2.body.payments.length, 2);
  const hist = (await api('GET', '/restaurant/subscription/history', { token: a.token })).body;
  assert.equal(hist.reduce((s, h) => s + h.paidDt, 0), 319, 'historique côté restaurant : paiements cumulés');
  const log = await query(`SELECT action FROM activity_logs WHERE restaurant_id = ? AND action LIKE 'subscription.%' ORDER BY id`, [a.rid]);
  assert.deepEqual(log.map((l) => l.action), ['subscription.activated', 'subscription.renewed']);
});

test('abonnement expiré : écritures bloquées puis rétablies par l’activation', async () => {
  const a = await signup('s3');
  const adm = await admin();
  await expire(a.rid);
  assert.equal((await api('POST', '/restaurant/categories', { token: a.token, body: { name: 'X' } })).status, 403);
  const r = await api('POST', `/admin/restaurants/${a.rid}/activate`, { token: adm, body: pay });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscriptions[0].status, 'active');
  assert.equal(r.body.subscriptions[1].status, 'expired', 'ancien essai clos');
  assert.equal((await api('POST', '/restaurant/categories', { token: a.token, body: { name: 'X' } })).status, 201);
});

test('annulation, jours offerts, suspension', async () => {
  const a = await seedPublic('s4');
  const adm = await admin();
  assert.equal((await fetch(`${base}/api/public/menu/${a.slug}`)).status, 200);

  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/cancel`, { token: adm, body: {} })).body.subscriptions[0].status, 'cancelled');
  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/cancel`, { token: adm, body: {} })).status, 409, 'rien à annuler');
  assert.equal((await api('POST', '/restaurant/categories', { token: a.token, body: { name: 'Y' } })).status, 403);
  assert.equal((await fetch(`${base}/api/public/menu/${a.slug}`)).status, 403, 'menu public indisponible');

  const g = await api('POST', `/admin/restaurants/${a.rid}/grant-days`, { token: adm, body: { days: 10, notes: 'Geste commercial' } });
  assert.equal(g.status, 200);
  const s = (await api('GET', '/restaurant/subscription', { token: a.token })).body;
  assert.equal(s.status, 'trial');
  assert.ok(s.daysLeft >= 9 && s.daysLeft <= 10);
  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/grant-days`, { token: adm, body: { days: 0 } })).status, 400);
  const g2 = await api('POST', `/admin/restaurants/${a.rid}/grant-days`, { token: adm, body: { days: 5 } });
  assert.ok((await api('GET', '/restaurant/subscription', { token: a.token })).body.daysLeft >= 14, 'jours ajoutés à la période en cours');
  assert.equal(g2.body.payments.length, 0, 'jours offerts : aucun paiement');
  assert.equal((await fetch(`${base}/api/public/menu/${a.slug}`)).status, 200);

  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/suspend`, { token: adm })).body.suspended, true);
  const me = await api('GET', '/auth/me', { token: a.token });
  assert.equal(me.status, 403);
  assert.equal(me.body.error.code, 'ACCOUNT_SUSPENDED');
  assert.equal((await fetch(`${base}/api/public/menu/${a.slug}`)).status, 403);
  assert.equal((await api('POST', `/admin/restaurants/${a.rid}/reactivate`, { token: adm })).body.suspended, false);
  assert.equal((await api('GET', '/auth/me', { token: a.token })).status, 200);
});

async function seedPublic(tag) {
  const a = await signup(tag);
  const c = await cat(a.token, 'Pizzas');
  await prod(a.token, c.id);
  return a;
}

test('liste des restaurants : filtres, recherche, pagination, statistiques, paiements', async () => {
  const adm = await admin();
  const t = await signup('l1');
  const p = await signup('l2');
  const e = await signup('l3');
  await api('POST', `/admin/restaurants/${p.rid}/activate`, { token: adm, body: { ...pay, amountDt: 31.5 } });
  await expire(e.rid);

  const by = async (filter) => (await api('GET', `/admin/restaurants?filter=${filter}&q=Pizzeria Test l`, { token: adm })).body.items.map((x) => x.id);
  assert.deepEqual(await by('trial'), [t.rid]);
  assert.deepEqual(await by('active'), [p.rid]);
  assert.deepEqual(await by('expired'), [e.rid], 'statut effectif calculé même sans mise à jour en base');
  assert.deepEqual(await by('expiring'), [t.rid], 'essai se terminant dans 3 jours');
  const one = (await api('GET', '/admin/restaurants?q=Pizzeria Test l2', { token: adm })).body.items[0];
  assert.equal(one.id, p.rid);
  assert.equal(one.owner.email.startsWith('test-l2-'), true);
  assert.equal(one.subscriptionStatus, 'active');
  assert.equal((await api('GET', '/admin/restaurants?filter=bogus', { token: adm })).status, 400);
  assert.equal((await api('GET', '/admin/restaurants?q=%25', { token: adm })).body.items.length, 0, 'LIKE échappé');

  const st = (await api('GET', '/admin/stats', { token: adm })).body;
  assert.ok(st.subscriptions.trial >= 1 && st.subscriptions.active >= 1 && st.subscriptions.expired >= 1);
  assert.ok(st.revenue.thisMonthDt >= 31.5);
  assert.equal(st.revenue.months.length, 6);

  const pays = (await api('GET', '/admin/payments', { token: adm })).body;
  assert.ok(pays.items.some((x) => x.restaurantId === p.rid && x.amountDt === 31.5));
  const det = (await api('GET', `/admin/restaurants/${p.rid}`, { token: adm })).body;
  assert.equal(JSON.stringify(det).includes('password'), false, 'jamais de hash de mot de passe');
  assert.equal(det.users[0].role, 'owner');
});

test('support : demande depuis un abonnement expiré, réponse du Super Admin, isolation', async () => {
  const a = await signup('t1');
  const b = await signup('t2');
  const adm = await admin();
  await expire(a.rid);
  assert.equal((await api('POST', '/restaurant/support', { token: a.token, body: { subject: 'ab', message: 'court' } })).status, 400);
  const t = await api('POST', '/restaurant/support', { token: a.token, body: { subject: 'Activer mon abonnement', message: 'Bonjour, j’ai réglé 29 DT en espèces.' } });
  assert.equal(t.status, 201, 'le support reste ouvert quand l’abonnement est terminé');
  assert.equal(t.body.status, 'open');

  assert.equal((await api('GET', '/restaurant/support', { token: b.token })).body.length, 0, 'B ne voit pas la demande de A');
  const list = await api('GET', '/admin/tickets?status=open', { token: adm });
  assert.ok(list.body.items.some((x) => x.id === t.body.id && x.restaurantName.startsWith('Pizzeria Test')));
  assert.equal((await api('PATCH', `/admin/tickets/${t.body.id}`, { token: adm, body: {} })).status, 400);
  assert.equal((await api('PATCH', `/admin/tickets/${t.body.id}`, { token: a.token, body: { status: 'closed' } })).status, 403);
  const r = await api('PATCH', `/admin/tickets/${t.body.id}`, { token: adm, body: { adminReply: 'Reçu, abonnement activé.', status: 'resolved' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'resolved');
  const mine = (await api('GET', '/restaurant/support', { token: a.token })).body[0];
  assert.equal(mine.adminReply, 'Reçu, abonnement activé.');
  assert.equal((await api('GET', `/admin/tickets/${t.body.id}`, { token: adm })).body.userEmail.startsWith('test-t1-'), true);
  assert.equal((await api('GET', '/admin/tickets/999999', { token: adm })).status, 404);
});
