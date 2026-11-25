import { query, queryOne, transaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { buildUpdate } from '../../utils/common.js';
import { logActivity } from '../../utils/activity.js';
import { destroyOwned, folderFor, storage } from '../../services/storage.js';
import { MAX_PRODUCT_IMAGES } from '../../middlewares/upload.js';

const MAX_PRODUCTS = 1000;

const toList = (r) => ({
  id: r.id,
  categoryId: r.category_id,
  categoryName: r.category_name,
  name: r.name,
  description: r.description,
  price: r.price,
  promoPrice: r.promo_price,
  isPromo: !!r.is_promo,
  isAvailable: !!r.is_available,
  isActive: !!r.is_active,
  isPopular: !!r.is_popular,
  sortOrder: r.sort_order,
  coverUrl: r.cover_url ?? null,
  variantsCount: Number(r.variants_count ?? 0),
  extrasCount: Number(r.extras_count ?? 0),
  createdAt: new Date(r.created_at).toISOString(),
});

const LIST_SQL = `
  SELECT p.*, c.name AS category_name,
    (SELECT url FROM product_images i WHERE i.product_id = p.id AND i.restaurant_id = p.restaurant_id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_url,
    (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.restaurant_id = p.restaurant_id) AS variants_count,
    (SELECT COUNT(*) FROM product_extras e WHERE e.product_id = p.id AND e.restaurant_id = p.restaurant_id) AS extras_count
  FROM products p
  JOIN categories c ON c.id = p.category_id AND c.restaurant_id = p.restaurant_id`;

async function getOwnedRow(restaurantId, id, conn) {
  const row = await queryOne(`${LIST_SQL} WHERE p.id = ? AND p.restaurant_id = ?`, [id, restaurantId], conn);
  if (!row) throw notFound('Produit introuvable.');
  return row;
}

async function assertCategory(restaurantId, categoryId, conn) {
  const c = await queryOne('SELECT id FROM categories WHERE id = ? AND restaurant_id = ?', [categoryId, restaurantId], conn);
  if (!c) throw badRequest('Catégorie invalide.', { categoryId: 'Catégorie introuvable.' });
}

function checkPrices(price, promoPrice, isPromo) {
  if (promoPrice != null && !(promoPrice < price)) throw badRequest('Le prix promotionnel doit être inférieur au prix.', { promoPrice: 'Doit être inférieur au prix normal.' });
  if (isPromo && promoPrice == null) throw badRequest('Indiquez le prix promotionnel.', { promoPrice: 'Prix promotionnel requis.' });
}

function normalizeVariants(variants) {
  const seen = new Set();
  for (const v of variants) {
    const k = v.name.toLowerCase();
    if (seen.has(k)) throw badRequest(`Variante en double : « ${v.name} ».`, { variants: 'Les noms des variantes doivent être uniques.' });
    seen.add(k);
  }
  if (!variants.length) return [];
  let defaultIndex = variants.findIndex((v) => v.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;
  return variants.map((v, i) => ({ ...v, isDefault: i === defaultIndex }));
}

function checkExtras(extras) {
  const seen = new Set();
  for (const e of extras) {
    const k = e.name.toLowerCase();
    if (seen.has(k)) throw badRequest(`Supplément en double : « ${e.name} ».`, { extras: 'Les noms des suppléments doivent être uniques.' });
    seen.add(k);
  }
}

async function replaceOptions(conn, restaurantId, productId, { variants, extras }) {
  if (variants) {
    await query('DELETE FROM product_variants WHERE product_id = ? AND restaurant_id = ?', [productId, restaurantId], conn);
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      await query('INSERT INTO product_variants (restaurant_id, product_id, name, price_delta, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [restaurantId, productId, v.name, v.priceDelta, Number(!!v.isDefault), i + 1], conn);
    }
  }
  if (extras) {
    await query('DELETE FROM product_extras WHERE product_id = ? AND restaurant_id = ?', [productId, restaurantId], conn);
    for (let i = 0; i < extras.length; i++) {
      const e = extras[i];
      await query('INSERT INTO product_extras (restaurant_id, product_id, name, price, is_required, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [restaurantId, productId, e.name, e.price, Number(!!e.isRequired), i + 1], conn);
    }
  }
}

export async function list(restaurantId, { categoryId, q, status }) {
  const where = ['p.restaurant_id = ?'];
  const params = [restaurantId];
  if (categoryId) { where.push('p.category_id = ?'); params.push(categoryId); }
  if (q) {
    where.push(`(p.name LIKE ? ESCAPE '\\\\' OR p.description LIKE ? ESCAPE '\\\\')`);
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like);
  }
  if (status === 'available') where.push('p.is_active = 1 AND p.is_available = 1');
  if (status === 'unavailable') where.push('p.is_active = 1 AND p.is_available = 0');
  if (status === 'inactive') where.push('p.is_active = 0');
  if (status === 'promo') where.push('p.is_promo = 1');
  const rows = await query(`${LIST_SQL} WHERE ${where.join(' AND ')} ORDER BY c.sort_order, p.sort_order, p.id LIMIT 1000`, params);
  return rows.map(toList);
}

export async function getOne(restaurantId, id) {
  const row = await getOwnedRow(restaurantId, id);
  const [images, variants, extras] = await Promise.all([
    query('SELECT id, url, sort_order FROM product_images WHERE product_id = ? AND restaurant_id = ? ORDER BY sort_order, id', [id, restaurantId]),
    query('SELECT id, name, price_delta, is_default FROM product_variants WHERE product_id = ? AND restaurant_id = ? ORDER BY sort_order, id', [id, restaurantId]),
    query('SELECT id, name, price, is_required FROM product_extras WHERE product_id = ? AND restaurant_id = ? ORDER BY sort_order, id', [id, restaurantId]),
  ]);
  return {
    ...toList(row),
    images: images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sort_order })),
    variants: variants.map((v) => ({ id: v.id, name: v.name, priceDelta: v.price_delta, isDefault: !!v.is_default })),
    extras: extras.map((e) => ({ id: e.id, name: e.name, price: e.price, isRequired: !!e.is_required })),
  };
}

export async function create(restaurantId, userId, data, ip) {
  await assertCategory(restaurantId, data.categoryId);
  checkPrices(data.price, data.promoPrice ?? null, data.isPromo);
  const variants = normalizeVariants(data.variants);
  checkExtras(data.extras);
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM products WHERE restaurant_id = ?', [restaurantId]);
  if (Number(n) >= MAX_PRODUCTS) throw badRequest(`Limite de ${MAX_PRODUCTS} produits atteinte.`);

  const id = await transaction(async (conn) => {
    const [{ next }] = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE restaurant_id = ? AND category_id = ?', [restaurantId, data.categoryId], conn);
    const r = await query(
      `INSERT INTO products (restaurant_id, category_id, name, description, price, promo_price, is_promo, is_available, is_active, is_popular, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [restaurantId, data.categoryId, data.name, data.description ?? null, data.price, data.promoPrice ?? null, Number(data.isPromo), Number(data.isAvailable), Number(data.isActive), Number(data.isPopular), Number(next)],
      conn
    );
    await replaceOptions(conn, restaurantId, r.insertId, { variants, extras: data.extras });
    return r.insertId;
  });
  await logActivity({ restaurantId, userId, action: 'product.created', entity: 'product', entityId: id, meta: { name: data.name }, ip });
  return getOne(restaurantId, id);
}

export async function update(restaurantId, userId, id, data, ip) {
  const current = await getOwnedRow(restaurantId, id);
  if (data.categoryId !== undefined) await assertCategory(restaurantId, data.categoryId);

  const price = data.price ?? current.price;
  const promoPrice = data.promoPrice !== undefined ? data.promoPrice : current.promo_price;
  const isPromo = data.isPromo ?? !!current.is_promo;
  checkPrices(price, promoPrice ?? null, isPromo);
  const variants = data.variants ? normalizeVariants(data.variants) : undefined;
  if (data.extras) checkExtras(data.extras);

  await transaction(async (conn) => {
    const { sets, params } = buildUpdate(
      { categoryId: 'category_id', name: 'name', description: 'description', price: 'price', promoPrice: 'promo_price', isPromo: 'is_promo', isAvailable: 'is_available', isActive: 'is_active', isPopular: 'is_popular' },
      data
    );
    if (data.categoryId !== undefined && data.categoryId !== current.category_id) {
      const [{ next }] = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE restaurant_id = ? AND category_id = ?', [restaurantId, data.categoryId], conn);
      sets.push('sort_order = ?'); params.push(Number(next));
    }
    if (sets.length) await query(`UPDATE products SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ?`, [...params, id, restaurantId], conn);
    await replaceOptions(conn, restaurantId, id, { variants, extras: data.extras });
  });
  await logActivity({ restaurantId, userId, action: 'product.updated', entity: 'product', entityId: id, meta: { name: data.name ?? current.name }, ip });
  return getOne(restaurantId, id);
}

export async function remove(restaurantId, userId, id, ip) {
  const row = await getOwnedRow(restaurantId, id);
  const imgs = await query('SELECT public_id FROM product_images WHERE product_id = ? AND restaurant_id = ?', [id, restaurantId]);
  await query('DELETE FROM products WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  await logActivity({ restaurantId, userId, action: 'product.deleted', entity: 'product', entityId: id, meta: { name: row.name }, ip });
  destroyOwned(restaurantId, imgs.map((i) => i.public_id).filter(Boolean));
}

export async function duplicate(restaurantId, userId, id, ip) {
  const src = await getOne(restaurantId, id);
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM products WHERE restaurant_id = ?', [restaurantId]);
  if (Number(n) >= MAX_PRODUCTS) throw badRequest(`Limite de ${MAX_PRODUCTS} produits atteinte.`);

  const newId = await transaction(async (conn) => {
    const [{ next }] = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products WHERE restaurant_id = ? AND category_id = ?', [restaurantId, src.categoryId], conn);
    const copyName = `${src.name.slice(0, 140)} (copie)`;
    const r = await query(
      `INSERT INTO products (restaurant_id, category_id, name, description, price, promo_price, is_promo, is_available, is_active, is_popular, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [restaurantId, src.categoryId, copyName, src.description, src.price, src.promoPrice, Number(src.isPromo), Number(src.isAvailable), Number(src.isActive), Number(next)],
      conn
    );
    await replaceOptions(conn, restaurantId, r.insertId, {
      variants: src.variants.map((v) => ({ name: v.name, priceDelta: v.priceDelta, isDefault: v.isDefault })),
      extras: src.extras.map((e) => ({ name: e.name, price: e.price, isRequired: e.isRequired })),
    });
    return r.insertId;
  });

  // Chaque produit possède ses propres fichiers : on copie les images (au mieux : un échec n'annule pas la duplication)
  if (storage.configured && src.images.length) {
    for (let i = 0; i < src.images.length; i++) {
      try {
        const copy = await storage.copy(src.images[i].url, { folder: folderFor(restaurantId, 'products') });
        await query('INSERT INTO product_images (restaurant_id, product_id, url, public_id, sort_order) VALUES (?, ?, ?, ?, ?)', [restaurantId, newId, copy.url, copy.publicId, i + 1]);
      } catch (e) {
        console.error('[products] copie d\'image échouée :', e.message);
      }
    }
  }
  await logActivity({ restaurantId, userId, action: 'product.duplicated', entity: 'product', entityId: newId, meta: { from: id }, ip });
  return getOne(restaurantId, newId);
}

export async function reorder(restaurantId, userId, ids, ip) {
  const unique = [...new Set(ids)];
  const rows = await query(`SELECT id FROM products WHERE restaurant_id = ? AND id IN (${unique.map(() => '?').join(',')})`, [restaurantId, ...unique]);
  if (rows.length !== unique.length) throw badRequest('Produit inconnu dans la liste.');
  await transaction(async (conn) => {
    for (let i = 0; i < unique.length; i++) await query('UPDATE products SET sort_order = ? WHERE id = ? AND restaurant_id = ?', [i + 1, unique[i], restaurantId], conn);
  });
  await logActivity({ restaurantId, userId, action: 'product.reordered', entity: 'product', ip });
}

export async function addImages(restaurantId, userId, id, files, ip) {
  await getOwnedRow(restaurantId, id);
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ? AND restaurant_id = ?', [id, restaurantId]);
  if (Number(n) + files.length > MAX_PRODUCT_IMAGES) throw badRequest(`${MAX_PRODUCT_IMAGES} photos maximum par produit.`);

  const uploaded = [];
  try {
    for (const f of files) uploaded.push(await storage.upload(f.buffer, { folder: folderFor(restaurantId, 'products') }));
    const [{ next }] = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM product_images WHERE product_id = ? AND restaurant_id = ?', [id, restaurantId]);
    for (let i = 0; i < uploaded.length; i++) {
      await query('INSERT INTO product_images (restaurant_id, product_id, url, public_id, sort_order) VALUES (?, ?, ?, ?, ?)', [restaurantId, id, uploaded[i].url, uploaded[i].publicId, Number(next) + i]);
    }
  } catch (err) {
    destroyOwned(restaurantId, uploaded.map((u) => u.publicId));
    throw err;
  }
  await logActivity({ restaurantId, userId, action: 'product.images_added', entity: 'product', entityId: id, meta: { count: files.length }, ip });
  return getOne(restaurantId, id);
}

export async function removeImage(restaurantId, userId, id, imageId, ip) {
  const img = await queryOne('SELECT id, public_id FROM product_images WHERE id = ? AND product_id = ? AND restaurant_id = ?', [imageId, id, restaurantId]);
  if (!img) throw notFound('Photo introuvable.');
  await query('DELETE FROM product_images WHERE id = ? AND restaurant_id = ?', [imageId, restaurantId]);
  if (img.public_id) destroyOwned(restaurantId, [img.public_id]);
  await logActivity({ restaurantId, userId, action: 'product.image_removed', entity: 'product', entityId: id, ip });
  return getOne(restaurantId, id);
}

export async function reorderImages(restaurantId, id, ids) {
  await getOwnedRow(restaurantId, id);
  const unique = [...new Set(ids)];
  const rows = await query(`SELECT id FROM product_images WHERE product_id = ? AND restaurant_id = ? AND id IN (${unique.map(() => '?').join(',')})`, [id, restaurantId, ...unique]);
  if (rows.length !== unique.length) throw badRequest('Photo inconnue dans la liste.');
  await transaction(async (conn) => {
    for (let i = 0; i < unique.length; i++) await query('UPDATE product_images SET sort_order = ? WHERE id = ? AND restaurant_id = ?', [i + 1, unique[i], restaurantId], conn);
  });
  return getOne(restaurantId, id);
}
