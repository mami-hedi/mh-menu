import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool, query } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
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

const raw = async (method, path, { headers = {}, body, token } = {}) => {
  const h = { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  return fetch(base + '/api' + path, { method, headers: h, body });
};

test('en-têtes de sécurité, pas de X-Powered-By, erreurs JSON sans trace', async () => {
  const r = await raw('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.ok(r.headers.get('strict-transport-security'));
  assert.ok(r.headers.get('content-security-policy'));
  assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
  const nf = await raw('GET', '/route-inconnue');
  assert.equal(nf.status, 404);
  const j = await nf.json();
  assert.equal(j.error.code, 'NOT_FOUND');
  assert.equal(JSON.stringify(j).includes('node_modules'), false);
  const bad = await raw('POST', '/auth/login', { headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, 'BAD_JSON');
  const big = await raw('POST', '/auth/login', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a'.repeat(200_000) }) });
  assert.equal(big.status, 413);
});

test('CORS : seule l’origine du frontend est autorisée', async () => {
  const ok = await raw('GET', '/health', { headers: { Origin: env.clientUrl } });
  assert.equal(ok.headers.get('access-control-allow-origin'), env.clientUrl);
  const evil = await raw('GET', '/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const pre = await raw('OPTIONS', '/restaurant/categories', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'DELETE' } });
  assert.equal(pre.headers.get('access-control-allow-origin'), null);
});

test('JWT : jetons falsifiés, expirés ou d’un utilisateur inconnu refusés', async () => {
  const a = await signup('j1');
  const good = (await api('GET', '/auth/me', { token: a.token })).status;
  assert.equal(good, 200);
  const sub = a.user.id;
  const forged = [
    jwt.sign({ sub, tv: 0 }, 'une-autre-cle-secrete-de-plus-de-32-caracteres!!'),                    // mauvaise clé
    jwt.sign({ sub, tv: 0 }, env.jwt.secret, { expiresIn: -10 }),                                        // expiré
    jwt.sign({ sub: 999999999, tv: 0 }, env.jwt.secret, { expiresIn: '1h' }),                            // utilisateur inexistant
    `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub, tv: 0 })).toString('base64url')}.`, // alg none
    jwt.sign({ sub, tv: 0 }, env.jwt.secret, { algorithm: 'HS512', expiresIn: '1h' }),                  // autre algorithme
    'abc.def.ghi', '', 'null',
  ];
  for (const t of forged) assert.equal((await api('GET', '/auth/me', { token: t || undefined })).status, 401, `jeton refusé : ${t.slice(0, 20)}`);
  // Jeton signé correctement mais avec une mauvaise version : révoqué
  assert.equal((await api('GET', '/auth/me', { token: jwt.sign({ sub, tv: 99 }, env.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' }) })).status, 401);
  // Déconnexion : l'ancien jeton n'est plus valable
  assert.equal((await api('POST', '/auth/logout', { token: a.token })).status, 204);
  assert.equal((await api('GET', '/auth/me', { token: a.token })).status, 401);
});

test('assignation de masse : les champs sensibles du corps sont ignorés', async () => {
  const a = await signup('m1');
  const b = await signup('m2');
  // inscription avec rôle / restaurant imposés
  const r = await api('POST', '/auth/register', { body: { ...mk('m3'), role: 'super_admin', restaurant_id: a.rid, restaurantId: a.rid, status: 'active' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'owner');
  assert.notEqual(r.body.restaurant.id, a.rid);
  const c = await cat(a.token);
  const p = (await api('POST', '/restaurant/products', { token: a.token, body: { categoryId: c.id, name: 'X', price: 5, restaurantId: b.rid, restaurant_id: b.rid } })).body;
  const [row] = await query('SELECT restaurant_id FROM products WHERE id = ?', [p.id]);
  assert.equal(row.restaurant_id, a.rid);
  const set = await api('PUT', '/restaurant/settings', { token: a.token, body: { name: 'Nouveau', slug: 'pirate', restaurantId: b.rid } });
  assert.equal(set.status, 200);
  assert.equal((await query('SELECT slug FROM restaurants WHERE id = ?', [a.rid]))[0].slug, a.slug, 'le slug ne change jamais');
  // Un propriétaire ne peut pas se promouvoir via le profil
  await api('PATCH', '/auth/me', { token: a.token, body: { name: 'Nouveau nom', role: 'super_admin', restaurant_id: b.rid } });
  const [u] = await query('SELECT role, restaurant_id FROM users WHERE id = ?', [a.user.id]);
  assert.deepEqual([u.role, u.restaurant_id], ['owner', a.rid]);
});

test('injections SQL / caractères spéciaux : jamais d’erreur 500 ni de fuite entre restaurants', async () => {
  const a = await signup('i1');
  const b = await signup('i2');
  const cb = await cat(b.token, 'Secret');
  await prod(b.token, cb.id, { name: 'Plat secret de B' });
  const ca = await cat(a.token, 'Pizzas');
  await prod(a.token, ca.id, { name: 'Margherita' });
  const payloads = ["' OR 1=1 --", "'; DROP TABLE products; --", '" OR ""="', '%', '_', '\\', '%\' OR 1=1 #', '\u0000', '😀', 'a'.repeat(500)];
  for (const pl of payloads) {
    const q = encodeURIComponent(pl);
    const r = await api('GET', `/restaurant/products?search=${q}`, { token: a.token });
    assert.ok(r.status === 200 || r.status === 400, `search ${pl.slice(0, 12)} → ${r.status}`);
    if (r.status === 200) assert.equal(JSON.stringify(r.body).includes('Plat secret de B'), false);
    const t = await api('GET', `/public/menu/${a.slug}?table=${q}`);
    assert.ok([200, 400].includes(t.status), `table ${pl.slice(0, 12)} → ${t.status}`);
    const s = await api('GET', `/public/menu/${q}`);
    assert.ok([400, 404].includes(s.status), `slug ${pl.slice(0, 12)} → ${s.status}`);
    const l = await api('POST', '/auth/login', { body: { email: pl, password: pl } });
    assert.ok([400, 401].includes(l.status));
    const ad = await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: pl } });
    assert.ok(ad.status < 500, `tableLabel ${pl.slice(0, 12)} → ${ad.status}`);
  }
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM products');
  assert.ok(Number(n) >= 2, 'la table products existe toujours');
  for (const bad of ['abc', '-1', '0', '1.5', '99999999999999999999', '1;DROP']) {
    assert.equal((await api('GET', `/restaurant/products/${bad}`, { token: a.token })).status, 400, `id ${bad}`);
  }
});

test('routes protégées : 401 sans jeton, 403 pour le mauvais rôle', async () => {
  const routes = [
    ['GET', '/auth/me'], ['PATCH', '/auth/me'], ['POST', '/auth/change-password'], ['POST', '/auth/logout'],
    ['GET', '/restaurant/subscription'], ['GET', '/restaurant/subscription/history'], ['GET', '/restaurant/dashboard'],
    ['GET', '/restaurant/categories'], ['POST', '/restaurant/categories'], ['PUT', '/restaurant/categories/reorder'], ['PATCH', '/restaurant/categories/1'], ['DELETE', '/restaurant/categories/1'], ['PUT', '/restaurant/categories/1/image'], ['DELETE', '/restaurant/categories/1/image'],
    ['GET', '/restaurant/products'], ['POST', '/restaurant/products'], ['GET', '/restaurant/products/1'], ['PATCH', '/restaurant/products/1'], ['DELETE', '/restaurant/products/1'], ['POST', '/restaurant/products/1/duplicate'], ['PUT', '/restaurant/products/reorder'], ['POST', '/restaurant/products/1/images'], ['PUT', '/restaurant/products/1/images/reorder'], ['DELETE', '/restaurant/products/1/images/1'],
    ['GET', '/restaurant/settings'], ['PUT', '/restaurant/settings'], ['PUT', '/restaurant/settings/images/logo'], ['DELETE', '/restaurant/settings/images/logo'],
    ['GET', '/restaurant/menu'], ['PUT', '/restaurant/menu'], ['GET', '/restaurant/qrcodes'], ['POST', '/restaurant/qrcodes'], ['POST', '/restaurant/qrcodes/bulk'], ['DELETE', '/restaurant/qrcodes/1'],
    ['GET', '/restaurant/support'], ['POST', '/restaurant/support'],
    ['GET', '/admin/stats'], ['GET', '/admin/restaurants'], ['GET', '/admin/restaurants/1'], ['POST', '/admin/restaurants/1/activate'], ['POST', '/admin/restaurants/1/grant-days'], ['POST', '/admin/restaurants/1/cancel'], ['POST', '/admin/restaurants/1/suspend'], ['POST', '/admin/restaurants/1/reactivate'], ['GET', '/admin/payments'], ['GET', '/admin/tickets'], ['GET', '/admin/tickets/1'], ['PATCH', '/admin/tickets/1'],
  ];
  const a = await signup('r1');
  const editor = await addStaff(a.rid, 'editor', 'r1');
  const json = { 'Content-Type': 'application/json' };
  for (const [m, p] of routes) {
    const body = m === 'GET' || m === 'DELETE' ? undefined : '{}';
    const anon = await raw(m, p, { headers: json, body });
    assert.equal(anon.status, 401, `${m} ${p} sans jeton`);
    if (p.startsWith('/admin')) assert.equal((await raw(m, p, { headers: json, body, token: a.token })).status, 403, `${m} ${p} propriétaire`);
    if (p.startsWith('/admin') || p.includes('/settings') || p.includes('/qrcodes') || p.endsWith('/menu')) {
      const r = await raw(m, p, { headers: json, body, token: editor });
      if (!(p.includes('/qrcodes') && m === 'GET')) assert.equal(r.status, 403, `${m} ${p} éditeur`);
    }
  }
  // Les routes publiques n'acceptent aucune écriture
  assert.equal((await raw('POST', `/public/menu/${a.slug}`, { headers: json, body: '{}' })).status, 404);
  assert.equal((await raw('DELETE', `/public/menu/${a.slug}`)).status, 404);
});

test('IDOR : un restaurant ne peut ni lire, ni modifier, ni supprimer les ressources d’un autre', async () => {
  const a = await signup('d1');
  const b = await signup('d2');
  const c = await cat(a.token, 'Pizzas');
  const p = await prod(a.token, c.id, { variants: [{ name: 'S', priceDelta: 0 }], extras: [{ name: 'E', price: 1 }] });
  const img = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', [[PNG, 'a.png', 'image/png']]) });
  const imgId = img.body.images[0].id;
  const qr = (await api('POST', '/restaurant/qrcodes', { token: a.token, body: { tableLabel: 'T1' } })).body.tables[0];

  const attempts = [
    ['GET', `/restaurant/products/${p.id}`], ['PATCH', `/restaurant/products/${p.id}`, { name: 'Piraté' }], ['DELETE', `/restaurant/products/${p.id}`],
    ['POST', `/restaurant/products/${p.id}/duplicate`], ['POST', `/restaurant/products/${p.id}/images`, null, imageForm('images', [[PNG, 'x.png', 'image/png']])],
    ['DELETE', `/restaurant/products/${p.id}/images/${imgId}`], ['PUT', `/restaurant/products/${p.id}/images/reorder`, { ids: [imgId] }],
    ['PATCH', `/restaurant/categories/${c.id}`, { name: 'Piraté' }], ['DELETE', `/restaurant/categories/${c.id}`], ['PUT', `/restaurant/categories/${c.id}/image`, null, imageForm('image', [[PNG, 'x.png', 'image/png']])],
    ['DELETE', `/restaurant/qrcodes/${qr.id}`],
  ];
  for (const [m, path, body, form] of attempts) {
    const r = await api(m, path, { token: b.token, body: body ?? undefined, form });
    assert.ok([400, 404].includes(r.status), `${m} ${path} → ${r.status}`);
  }
  // Un produit de B ne peut pas être rangé dans la catégorie de A, ni l'inverse
  const cb = await cat(b.token, 'Autre');
  assert.equal((await api('POST', '/restaurant/products', { token: b.token, body: { categoryId: c.id, name: 'Intrus', price: 3 } })).status, 400);
  assert.equal((await api('PUT', '/restaurant/products/reorder', { token: b.token, body: { ids: [p.id] } })).status, 400);
  assert.equal((await api('PUT', '/restaurant/categories/reorder', { token: b.token, body: { ids: [c.id, cb.id] } })).status, 400);
  // Rien n'a changé chez A
  const after = (await api('GET', `/restaurant/products/${p.id}`, { token: a.token })).body;
  assert.equal(after.name, 'Margherita');
  assert.equal(after.images.length, 1);
  assert.equal((await api('GET', '/restaurant/categories', { token: a.token })).body.length, 1);
  assert.equal((await api('GET', '/restaurant/qrcodes', { token: a.token })).body.tables.length, 1);
  // Le détail d'un produit n'apparaît jamais dans les listes de B
  assert.equal(JSON.stringify((await api('GET', '/restaurant/products', { token: b.token })).body).includes('Margherita'), false);
});

test('aucun hash de mot de passe ni jeton interne dans les réponses', async () => {
  const a = await signup('h1');
  const adm = await (async () => {
    const bcrypt = (await import('bcrypt')).default;
    const email = `test-admin-h-${crypto.randomBytes(3).toString('hex')}@example.com`;
    await query(`INSERT INTO users (restaurant_id, name, email, password_hash, role) VALUES (NULL, 'A', ?, ?, 'super_admin')`, [email, await bcrypt.hash(PASSWORD, 4)]);
    return (await api('POST', '/auth/login', { body: { email, password: PASSWORD } })).body.token;
  })();
  const dumps = [
    await api('GET', '/auth/me', { token: a.token }), await api('GET', '/restaurant/dashboard', { token: a.token }),
    await api('GET', `/admin/restaurants/${a.rid}`, { token: adm }), await api('GET', '/admin/restaurants', { token: adm }),
    await api('POST', '/auth/login', { body: { email: a.user.email, password: PASSWORD } }),
  ];
  for (const d of dumps) {
    const t = JSON.stringify(d.body);
    assert.equal(/password_hash|passwordHash|\$2[aby]\$|token_version|tokenVersion/.test(t), false);
  }
});

test('pas d’énumération de comptes : mêmes réponses pour un e-mail connu ou inconnu', async () => {
  const a = await signup('e1');
  const known = await api('POST', '/auth/login', { body: { email: a.user.email, password: 'MauvaisMdp123' } });
  const unknown = await api('POST', '/auth/login', { body: { email: 'inconnu-zz@example.com', password: 'MauvaisMdp123' } });
  assert.equal(known.status, 401);
  assert.deepEqual(known.body, unknown.body);
  const f1 = await api('POST', '/auth/forgot-password', { body: { email: a.user.email } });
  const f2 = await api('POST', '/auth/forgot-password', { body: { email: 'inconnu-zz@example.com' } });
  assert.equal(f1.status, f2.status);
  assert.deepEqual(f1.body, f2.body);
});

test('jetons de réinitialisation : stockés hachés, à usage unique, invalides une fois utilisés', async () => {
  const a = await signup('p1');
  await api('POST', '/auth/forgot-password', { body: { email: a.user.email } });
  const [row] = await query('SELECT token_hash FROM password_resets WHERE user_id = ? ORDER BY id DESC LIMIT 1', [a.user.id]);
  assert.match(row.token_hash, /^[0-9a-f]{64}$/, 'seul un hachage SHA-256 est stocké');
  // Un hachage fourni comme jeton ne doit pas être accepté
  const r = await api('POST', '/auth/reset-password', { body: { token: row.token_hash, password: 'NouveauMdp12345', confirmPassword: 'NouveauMdp12345' } });
  assert.ok([400, 401, 404, 410].includes(r.status), `hachage refusé (${r.status})`);
});

test('configuration production : refuse secret d’exemple, CLIENT_URL absent ou en http', async () => {
  const { spawnSync } = await import('node:child_process');
  const base = { PATH: process.env.PATH, NODE_ENV: 'production', DB_HOST: 'h', DB_USER: 'u', DB_NAME: 'n', JWT_SECRET: crypto.randomBytes(40).toString('hex'), CLIENT_URL: 'https://app.example.com' };
  const run = (over) => spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/env.js')"], { cwd: new URL('..', import.meta.url).pathname, env: { ...base, ...over }, encoding: 'utf8' });
  assert.equal(run({}).status, 0, 'configuration valide acceptée');
  assert.notEqual(run({ JWT_SECRET: 'change-me-change-me-change-me-change-me-0000' }).status, 0);
  assert.notEqual(run({ JWT_SECRET: 'court' }).status, 0);
  assert.notEqual(run({ CLIENT_URL: 'http://app.example.com' }).status, 0);
  assert.notEqual(run({ CLIENT_URL: '' }).status, 0);
});
