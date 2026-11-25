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

test('catégories : CRUD, doublons, ordre, activation', async () => {
  const a = await signup('c1');
  const c1 = await cat(a.token, 'Pizzas');
  const c2 = await cat(a.token, 'Burgers');
  const c3 = await cat(a.token, 'Desserts');
  assert.deepEqual([c1.sortOrder, c2.sortOrder, c3.sortOrder], [1, 2, 3]);
  assert.equal((await api('POST', '/restaurant/categories', { token: a.token, body: { name: 'pizzas' } })).status, 409, 'doublon insensible à la casse');
  assert.equal((await api('POST', '/restaurant/categories', { token: a.token, body: { name: '   ' } })).status, 400);

  const up = await api('PATCH', `/restaurant/categories/${c2.id}`, { token: a.token, body: { name: 'Burgers maison', isActive: false, description: 'Nos burgers' } });
  assert.equal(up.status, 200);
  assert.equal(up.body.isActive, false);
  assert.equal(up.body.name, 'Burgers maison');

  const ro = await api('PUT', '/restaurant/categories/reorder', { token: a.token, body: { ids: [c3.id, c1.id, c2.id] } });
  assert.deepEqual(ro.body.map((c) => c.id), [c3.id, c1.id, c2.id]);
  assert.deepEqual((await api('GET', '/restaurant/categories', { token: a.token })).body.map((c) => c.name), ['Desserts', 'Pizzas', 'Burgers maison']);

  assert.equal((await api('DELETE', `/restaurant/categories/${c3.id}`, { token: a.token })).status, 204);
  assert.equal((await api('GET', '/restaurant/categories', { token: a.token })).body.length, 2);
});

test('catégories : isolation stricte entre restaurants', async () => {
  const a = await signup('ci-a');
  const b = await signup('ci-b');
  const ca = await cat(a.token, 'Secrète');
  assert.equal((await api('GET', '/restaurant/categories', { token: b.token })).body.length, 0);
  assert.equal((await api('PATCH', `/restaurant/categories/${ca.id}`, { token: b.token, body: { name: 'Piratée' } })).status, 404);
  assert.equal((await api('DELETE', `/restaurant/categories/${ca.id}`, { token: b.token })).status, 404);
  assert.equal((await api('PUT', `/restaurant/categories/${ca.id}/image`, { token: b.token, form: imageForm('image', [[PNG, 'a.png', 'image/png']]) })).status, 404);
  const cb = await cat(b.token, 'Mienne');
  assert.equal((await api('PUT', '/restaurant/categories/reorder', { token: b.token, body: { ids: [cb.id, ca.id] } })).status, 400, 'réordonner avec une catégorie étrangère est refusé');
  const still = (await api('GET', '/restaurant/categories', { token: a.token })).body;
  assert.equal(still[0].name, 'Secrète');
});

test('produits : création avec variantes/suppléments, lecture, validation des prix', async () => {
  const a = await signup('p1');
  const c = await cat(a.token);
  const p = await prod(a.token, c.id, {
    description: 'Tomate, mozzarella', price: 12.5, isPopular: true,
    variants: [{ name: 'Moyenne', priceDelta: 0 }, { name: 'Grande', priceDelta: 4 }],
    extras: [{ name: 'Fromage', price: 2 }, { name: 'Taille de la pâte', price: 0, isRequired: true }],
  });
  assert.ok(p.id);
  assert.equal(p.price, 12.5);
  assert.equal(p.variants.length, 2);
  assert.equal(p.variants.filter((v) => v.isDefault).length, 1, 'une seule variante par défaut');
  assert.equal(p.variants[0].isDefault, true);
  assert.equal(p.extras[1].isRequired, true);
  assert.equal(p.isPopular, true);

  const bad = (body) => api('POST', '/restaurant/products', { token: a.token, body: { categoryId: c.id, name: 'X', price: 10, ...body } });
  assert.equal((await bad({ price: -1 })).status, 400, 'prix négatif');
  assert.equal((await bad({ price: 10.1234 })).status, 400, '4 décimales');
  assert.equal((await bad({ price: 10, promoPrice: 12 })).status, 400, 'promo ≥ prix');
  assert.equal((await bad({ isPromo: true })).status, 400, 'promo sans prix promo');
  assert.equal((await bad({ name: '' })).status, 400);
  assert.equal((await bad({ variants: [{ name: 'A', priceDelta: 0 }, { name: 'a', priceDelta: 1 }] })).status, 400, 'variantes en double');
  assert.equal((await bad({ extras: [{ name: 'Z', price: 1 }, { name: 'z', price: 1 }] })).status, 400, 'suppléments en double');
  assert.equal((await bad({ categoryId: 999999999 })).status, 400, 'catégorie inexistante');
  assert.equal((await bad({ price: '10' })).status, 400, 'le prix doit être un nombre');
});

test('produits : mise à jour partielle, promotion, remplacement des options', async () => {
  const a = await signup('p2');
  const c = await cat(a.token);
  const p = await prod(a.token, c.id, { price: 20, variants: [{ name: 'S', priceDelta: 0 }, { name: 'L', priceDelta: 3 }], extras: [{ name: 'Olives', price: 1 }] });

  const promo = await api('PATCH', `/restaurant/products/${p.id}`, { token: a.token, body: { isPromo: true, promoPrice: 15 } });
  assert.equal(promo.status, 200);
  assert.equal(promo.body.isPromo, true);
  assert.equal(promo.body.promoPrice, 15);
  assert.equal(promo.body.variants.length, 2, 'les variantes sont conservées si non fournies');

  assert.equal((await api('PATCH', `/restaurant/products/${p.id}`, { token: a.token, body: { price: 10 } })).status, 400, 'baisser le prix sous le prix promo est refusé');
  const unavailable = await api('PATCH', `/restaurant/products/${p.id}`, { token: a.token, body: { isAvailable: false } });
  assert.equal(unavailable.body.isAvailable, false);

  const repl = await api('PATCH', `/restaurant/products/${p.id}`, { token: a.token, body: { variants: [{ name: 'Unique', priceDelta: 0 }], extras: [] } });
  assert.deepEqual(repl.body.variants.map((v) => v.name), ['Unique']);
  assert.equal(repl.body.extras.length, 0);

  const c2 = await cat(a.token, 'Autre');
  const moved = await api('PATCH', `/restaurant/products/${p.id}`, { token: a.token, body: { categoryId: c2.id } });
  assert.equal(moved.body.categoryId, c2.id);
});

test('produits : liste filtrée, recherche littérale, réordonnancement', async () => {
  const a = await signup('p3');
  const c = await cat(a.token);
  const p1 = await prod(a.token, c.id, { name: 'Pizza 100% fromage', price: 10 });
  const p2 = await prod(a.token, c.id, { name: 'Burger', price: 8, isAvailable: false });
  const p3 = await prod(a.token, c.id, { name: 'Salade', price: 6, isActive: false });
  await api('PATCH', `/restaurant/products/${p1.id}`, { token: a.token, body: { isPromo: true, promoPrice: 8 } });
  const get = async (qs) => (await api('GET', `/restaurant/products${qs}`, { token: a.token })).body.map((x) => x.name);

  assert.equal((await get('')).length, 3);
  assert.deepEqual(await get('?status=available'), ['Pizza 100% fromage']);
  assert.deepEqual(await get('?status=unavailable'), ['Burger']);
  assert.deepEqual(await get('?status=inactive'), ['Salade']);
  assert.deepEqual(await get('?status=promo'), ['Pizza 100% fromage']);
  assert.deepEqual(await get('?q=burg'), ['Burger']);
  assert.deepEqual(await get('?q=%25'), ['Pizza 100% fromage'], '« % » est cherché littéralement, pas comme joker');
  assert.deepEqual(await get('?q=_'), [], '« _ » n’est pas un joker');
  assert.equal((await api('GET', '/restaurant/products?status=nimporte', { token: a.token })).status, 400);

  assert.equal((await api('PUT', '/restaurant/products/reorder', { token: a.token, body: { ids: [p3.id, p2.id, p1.id] } })).status, 204);
  assert.deepEqual(await get(''), ['Salade', 'Burger', 'Pizza 100% fromage']);
});

test('produits : duplication (options et photos copiées, popularité retirée)', async () => {
  const a = await signup('p4');
  const c = await cat(a.token);
  const p = await prod(a.token, c.id, { name: 'Reine', price: 15, isPopular: true, variants: [{ name: 'M', priceDelta: 0 }], extras: [{ name: 'Œuf', price: 1.5 }] });
  await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', [[PNG, '1.png', 'image/png'], [PNG, '2.png', 'image/png']]) });

  const before = fake.copies.length;
  const d = await api('POST', `/restaurant/products/${p.id}/duplicate`, { token: a.token });
  assert.equal(d.status, 201);
  assert.equal(d.body.name, 'Reine (copie)');
  assert.notEqual(d.body.id, p.id);
  assert.equal(d.body.isPopular, false);
  assert.equal(d.body.variants.length, 1);
  assert.equal(d.body.extras[0].name, 'Œuf');
  assert.equal(d.body.images.length, 2);
  assert.equal(fake.copies.length - before, 2, 'chaque photo est copiée, pas partagée');
  const origin = (await api('GET', `/restaurant/products/${p.id}`, { token: a.token })).body;
  assert.notDeepEqual(origin.images.map((i) => i.url), d.body.images.map((i) => i.url));
});

test('produits : isolation stricte entre restaurants', async () => {
  const a = await signup('pi-a');
  const b = await signup('pi-b');
  const ca = await cat(a.token);
  const pa = await prod(a.token, ca.id, { name: 'Confidentiel' });
  await api('POST', `/restaurant/products/${pa.id}/images`, { token: a.token, form: imageForm('images', [[PNG, '1.png', 'image/png']]) });
  const full = (await api('GET', `/restaurant/products/${pa.id}`, { token: a.token })).body;

  assert.equal((await api('GET', `/restaurant/products/${pa.id}`, { token: b.token })).status, 404);
  assert.equal((await api('PATCH', `/restaurant/products/${pa.id}`, { token: b.token, body: { name: 'Piraté' } })).status, 404);
  assert.equal((await api('DELETE', `/restaurant/products/${pa.id}`, { token: b.token })).status, 404);
  assert.equal((await api('POST', `/restaurant/products/${pa.id}/duplicate`, { token: b.token })).status, 404);
  assert.equal((await api('POST', `/restaurant/products/${pa.id}/images`, { token: b.token, form: imageForm('images', [[PNG, 'x.png', 'image/png']]) })).status, 404);
  assert.equal((await api('DELETE', `/restaurant/products/${pa.id}/images/${full.images[0].id}`, { token: b.token })).status, 404);
  assert.equal((await api('POST', '/restaurant/products', { token: b.token, body: { categoryId: ca.id, name: 'Intrus', price: 5 } })).status, 400, 'créer un produit dans la catégorie d\'un autre est refusé');
  assert.equal((await api('GET', '/restaurant/products', { token: b.token })).body.length, 0);
  assert.equal((await api('PUT', '/restaurant/products/reorder', { token: b.token, body: { ids: [pa.id] } })).status, 400);

  const intact = (await api('GET', `/restaurant/products/${pa.id}`, { token: a.token })).body;
  assert.equal(intact.name, 'Confidentiel');
  assert.equal(intact.images.length, 1);
});

test('photos : formats, limites, suppression côté stockage', async () => {
  const a = await signup('img');
  const c = await cat(a.token);
  const p = await prod(a.token, c.id);

  const text = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', [[Buffer.from('<?php echo 1;'), 'x.png', 'image/png']]) });
  assert.equal(text.status, 400, 'faux PNG (contenu non image) refusé malgré le type MIME');
  const svg = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', [[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml']]) });
  assert.equal(svg.status, 400, 'SVG refusé');
  const big = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', [[Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'big.png', 'image/png']]) });
  assert.equal(big.status, 413, 'plus de 5 Mo refusé');
  const none = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: new FormData() });
  assert.equal(none.status, 400);

  const ok = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', Array.from({ length: 4 }, (_, i) => [PNG, `${i}.png`, 'image/png'])) });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.images.length, 4);
  const over = await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', Array.from({ length: 3 }, (_, i) => [PNG, `${i}.png`, 'image/png'])) });
  assert.equal(over.status, 400, '6 photos maximum par produit');
  const uploadsBefore = fake.uploads.length;
  assert.equal((await api('GET', `/restaurant/products/${p.id}`, { token: a.token })).body.images.length, 4, 'rien n\'a été ajouté après le refus');
  assert.equal(fake.uploads.length, uploadsBefore);

  const [first, second] = ok.body.images;
  const reordered = await api('PUT', `/restaurant/products/${p.id}/images/reorder`, { token: a.token, body: { ids: [second.id, first.id, ...ok.body.images.slice(2).map((i) => i.id)] } });
  assert.equal(reordered.body.images[0].id, second.id);

  const [{ public_id }] = await query('SELECT public_id FROM product_images WHERE id = ?', [first.id]);
  const rm = await api('DELETE', `/restaurant/products/${p.id}/images/${first.id}`, { token: a.token });
  assert.equal(rm.body.images.length, 3);
  await sleep(50);
  assert.ok(fake.destroyed.includes(public_id), 'l\'image est supprimée du stockage');

  const toDelete = (await query('SELECT public_id FROM product_images WHERE product_id = ?', [p.id])).map((r) => r.public_id);
  assert.equal((await api('DELETE', `/restaurant/products/${p.id}`, { token: a.token })).status, 204);
  await sleep(50);
  for (const id of toDelete) assert.ok(fake.destroyed.includes(id), 'les photos d\'un produit supprimé sont supprimées du stockage');
});

test('stockage non configuré : 503 explicite, rien n\'est simulé', async () => {
  const a = await signup('nostore');
  const c = await cat(a.token);
  fake.configured = false;
  try {
    const r = await api('PUT', `/restaurant/categories/${c.id}/image`, { token: a.token, form: imageForm('image', [[PNG, 'a.png', 'image/png']]) });
    assert.equal(r.status, 503);
    assert.equal(r.body.error.code, 'STORAGE_NOT_CONFIGURED');
  } finally { fake.configured = true; }
});

test('image de catégorie : remplacement supprime l\'ancienne ; ownership des identifiants Cloudinary', async () => {
  const a = await signup('cimg');
  const c = await cat(a.token);
  const one = await api('PUT', `/restaurant/categories/${c.id}/image`, { token: a.token, form: imageForm('image', [[PNG, 'a.png', 'image/png']]) });
  assert.match(one.body.imageUrl, /^https:\/\/cdn\.test\//);
  const [{ image_public_id: first }] = await query('SELECT image_public_id FROM categories WHERE id = ?', [c.id]);
  await api('PUT', `/restaurant/categories/${c.id}/image`, { token: a.token, form: imageForm('image', [[PNG, 'b.png', 'image/png']]) });
  await sleep(50);
  assert.ok(fake.destroyed.includes(first));
  assert.equal(ownsPublicId(a.rid, `mh-menu/r${a.rid}/products/x`), true);
  assert.equal(ownsPublicId(a.rid, `mh-menu/r${a.rid + 1}/products/x`), false);
  assert.equal(ownsPublicId(1, 'mh-menu/r12/products/x'), false, 'r1 ne doit pas matcher r12');
  const none = await api('DELETE', `/restaurant/categories/${c.id}/image`, { token: a.token });
  assert.equal(none.body.imageUrl, null);
});

test('suppression d\'une catégorie : produits supprimés et photos nettoyées', async () => {
  const a = await signup('cdel');
  const c = await cat(a.token);
  const p = await prod(a.token, c.id);
  await api('POST', `/restaurant/products/${p.id}/images`, { token: a.token, form: imageForm('images', [[PNG, '1.png', 'image/png']]) });
  const [{ public_id }] = await query('SELECT public_id FROM product_images WHERE product_id = ?', [p.id]);
  assert.equal((await api('DELETE', `/restaurant/categories/${c.id}`, { token: a.token })).status, 204);
  await sleep(50);
  assert.equal((await api('GET', '/restaurant/products', { token: a.token })).body.length, 0);
  assert.ok(fake.destroyed.includes(public_id));
});

test('paramètres : lecture, mise à jour, slug stable, validations', async () => {
  const a = await signup('set');
  const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { closed: d === 'sun', open: '09:00', close: '23:00' }]));
  const put = (body) => api('PUT', '/restaurant/settings', { token: a.token, body });

  const r = await put({
    name: 'Chez Jasmin', description: 'Cuisine maison', address: 'Hammamet', phone: '+216 98 000 000', primaryColor: '#112233', secondaryColor: '#00B8D9',
    openingHours: hours, socialLinks: { facebook: 'https://facebook.com/jasmin', instagram: '', whatsapp: '+216 98 000 000' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.name, 'Chez Jasmin');
  assert.equal(r.body.slug, a.slug, 'le slug (donc l\'URL et le QR Code) ne change pas');
  assert.equal(r.body.openingHours.sun.closed, true);
  assert.deepEqual(Object.keys(r.body.socialLinks).sort(), ['facebook', 'whatsapp'], 'liens vides retirés');
  assert.equal(r.body.currency, 'DT');
  assert.equal((await api('GET', '/restaurant/settings', { token: a.token })).body.primaryColor, '#112233');

  assert.equal((await put({ primaryColor: 'rouge' })).status, 400);
  assert.equal((await put({ socialLinks: { website: 'javascript:alert(1)' } })).status, 400, 'liens javascript: refusés');
  assert.equal((await put({ socialLinks: { website: 'data:text/html,<script>' } })).status, 400);
  assert.equal((await put({ openingHours: { ...hours, mon: { closed: false, open: '25:00', close: '23:00' } } })).status, 400);
  assert.equal((await put({ name: 'X' })).status, 400);
  assert.equal((await put({ phone: 'abc' })).status, 400);

  const logo = await api('PUT', '/restaurant/settings/images/logo', { token: a.token, form: imageForm('image', [[PNG, 'l.png', 'image/png']]) });
  assert.match(logo.body.logoUrl, /^https:\/\/cdn\.test\//);
  const cover = await api('PUT', '/restaurant/settings/images/cover', { token: a.token, form: imageForm('image', [[PNG, 'c.png', 'image/png']]) });
  assert.ok(cover.body.coverUrl && cover.body.logoUrl);
  assert.equal((await api('PUT', '/restaurant/settings/images/banner', { token: a.token, form: imageForm('image', [[PNG, 'c.png', 'image/png']]) })).status, 400);
  assert.equal((await api('DELETE', '/restaurant/settings/images/logo', { token: a.token })).body.logoUrl, null);
});

test('paramètres : isolation entre restaurants', async () => {
  const a = await signup('si-a');
  const b = await signup('si-b');
  await api('PUT', '/restaurant/settings', { token: a.token, body: { description: 'Description A' } });
  await api('PUT', '/restaurant/settings', { token: b.token, body: { description: 'Description B', name: 'Resto B' } });
  const ga = (await api('GET', '/restaurant/settings', { token: a.token })).body;
  assert.equal(ga.description, 'Description A');
  assert.notEqual(ga.name, 'Resto B');
});

test('rôles : editor crée mais ne supprime pas et n\'accède pas aux paramètres', async () => {
  const a = await signup('role');
  const editor = await addStaff(a.rid, 'editor', 'r');
  const manager = await addStaff(a.rid, 'manager', 'r');
  const c = await cat(editor, 'Entrées');
  assert.ok(c.id, 'editor peut créer une catégorie');
  const p = await prod(editor, c.id, { name: 'Salade' });
  assert.ok(p.id, 'editor peut créer un produit');
  assert.equal((await api('PATCH', `/restaurant/products/${p.id}`, { token: editor, body: { isAvailable: false } })).status, 200);
  assert.equal((await api('DELETE', `/restaurant/products/${p.id}`, { token: editor })).status, 403);
  assert.equal((await api('DELETE', `/restaurant/categories/${c.id}`, { token: editor })).status, 403);
  assert.equal((await api('GET', '/restaurant/settings', { token: editor })).status, 403);
  assert.equal((await api('PUT', '/restaurant/settings', { token: editor, body: { description: 'x' } })).status, 403);
  assert.equal((await api('GET', '/restaurant/settings', { token: manager })).status, 200);
  assert.equal((await api('DELETE', `/restaurant/products/${p.id}`, { token: manager })).status, 204);
  assert.equal((await api('GET', '/restaurant/categories')).status, 401);
});

test('abonnement expiré : lecture possible, toute écriture bloquée', async () => {
  const a = await signup('exp3');
  const c = await cat(a.token);
  const p = await prod(a.token, c.id);
  await query('UPDATE subscriptions SET starts_at = ?, ends_at = ? WHERE restaurant_id = ?', [new Date(Date.now() - 5 * 864e5), new Date(Date.now() - 864e5), a.rid]);
  assert.equal((await api('GET', '/restaurant/products', { token: a.token })).status, 200);
  assert.equal((await api('GET', '/restaurant/settings', { token: a.token })).status, 200);
  for (const [m, path, body] of [
    ['POST', '/restaurant/categories', { name: 'Nouvelle' }],
    ['POST', '/restaurant/products', { categoryId: c.id, name: 'N', price: 1 }],
    ['PATCH', `/restaurant/products/${p.id}`, { name: 'Z' }],
    ['DELETE', `/restaurant/products/${p.id}`],
    ['PUT', '/restaurant/settings', { description: 'x' }],
  ]) {
    const r = await api(m, path, { token: a.token, body });
    assert.equal(r.status, 403, `${m} ${path}`);
    assert.equal(r.body.error.code, 'SUBSCRIPTION_REQUIRED');
  }
});

test('profil et mot de passe : mise à jour, révocation des anciennes sessions', async () => {
  const a = await signup('prof');
  const up = await api('PATCH', '/auth/me', { token: a.token, body: { name: 'Nouveau Nom', phone: '+216 55 111 222' } });
  assert.equal(up.status, 200);
  assert.equal(up.body.user.name, 'Nouveau Nom');
  assert.equal((await api('PATCH', '/auth/me', { token: a.token, body: { name: '' } })).status, 400);

  const wrong = await api('POST', '/auth/change-password', { token: a.token, body: { currentPassword: 'Mauvais12345', password: 'NouveauMdp456', confirmPassword: 'NouveauMdp456' } });
  assert.equal(wrong.status, 400);
  assert.ok(wrong.body.error.details.currentPassword);
  const weak = await api('POST', '/auth/change-password', { token: a.token, body: { currentPassword: PASSWORD, password: 'court', confirmPassword: 'court' } });
  assert.equal(weak.status, 400);

  const ok = await api('POST', '/auth/change-password', { token: a.token, body: { currentPassword: PASSWORD, password: 'NouveauMdp456', confirmPassword: 'NouveauMdp456' } });
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/auth/me', { token: a.token })).status, 401, 'ancien jeton révoqué');
  assert.equal((await api('GET', '/auth/me', { token: ok.body.token })).status, 200, 'nouveau jeton valide');
});

test('dashboard reflète le catalogue réel', async () => {
  const a = await signup('dash');
  const c = await cat(a.token);
  await prod(a.token, c.id, { name: 'A' });
  await prod(a.token, c.id, { name: 'B', isAvailable: false });
  const d = (await api('GET', '/restaurant/dashboard', { token: a.token })).body;
  assert.deepEqual(d.products, { total: 2, available: 1, unavailable: 1 });
  assert.equal(d.categories, 1);
  assert.ok(d.recentActivity.some((x) => x.action === 'product.created'));
});
