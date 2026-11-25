import { query, queryOne, transaction } from '../../config/db.js';
import { badRequest, notFound, conflict } from '../../utils/errors.js';
import { buildUpdate } from '../../utils/common.js';
import { logActivity } from '../../utils/activity.js';
import { destroyOwned, folderFor, storage } from '../../services/storage.js';

const MAX_CATEGORIES = 100;

const toApi = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  imageUrl: r.image_url,
  sortOrder: r.sort_order,
  isActive: !!r.is_active,
  productCount: Number(r.product_count ?? 0),
  createdAt: new Date(r.created_at).toISOString(),
});

const SELECT = `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.restaurant_id = c.restaurant_id) AS product_count
                  FROM categories c`;

async function getOwned(restaurantId, id, conn) {
  const row = await queryOne(`${SELECT} WHERE c.id = ? AND c.restaurant_id = ?`, [id, restaurantId], conn);
  if (!row) throw notFound('Catégorie introuvable.');
  return row;
}

export async function list(restaurantId) {
  const rows = await query(`${SELECT} WHERE c.restaurant_id = ? ORDER BY c.sort_order, c.id`, [restaurantId]);
  return rows.map(toApi);
}

export async function create(restaurantId, userId, data, ip) {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM categories WHERE restaurant_id = ?', [restaurantId]);
  if (Number(n) >= MAX_CATEGORIES) throw badRequest(`Limite de ${MAX_CATEGORIES} catégories atteinte.`);
  const dup = await queryOne('SELECT id FROM categories WHERE restaurant_id = ? AND LOWER(name) = LOWER(?)', [restaurantId, data.name]);
  if (dup) throw conflict('Une catégorie porte déjà ce nom.');

  const [{ next }] = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories WHERE restaurant_id = ?', [restaurantId]);
  const r = await query(
    'INSERT INTO categories (restaurant_id, name, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?)',
    [restaurantId, data.name, data.description ?? null, Number(data.isActive ?? true), Number(next)]
  );
  await logActivity({ restaurantId, userId, action: 'category.created', entity: 'category', entityId: r.insertId, meta: { name: data.name }, ip });
  return toApi(await getOwned(restaurantId, r.insertId));
}

export async function update(restaurantId, userId, id, data, ip) {
  await getOwned(restaurantId, id);
  if (data.name !== undefined) {
    const dup = await queryOne('SELECT id FROM categories WHERE restaurant_id = ? AND LOWER(name) = LOWER(?) AND id <> ?', [restaurantId, data.name, id]);
    if (dup) throw conflict('Une catégorie porte déjà ce nom.');
  }
  const { sets, params } = buildUpdate({ name: 'name', description: 'description', isActive: 'is_active' }, data);
  if (sets.length) await query(`UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ?`, [...params, id, restaurantId]);
  await logActivity({ restaurantId, userId, action: 'category.updated', entity: 'category', entityId: id, ip });
  return toApi(await getOwned(restaurantId, id));
}

export async function remove(restaurantId, userId, id, ip) {
  const cat = await getOwned(restaurantId, id);
  const imgs = await query('SELECT public_id FROM product_images WHERE restaurant_id = ? AND product_id IN (SELECT id FROM products WHERE category_id = ? AND restaurant_id = ?)', [restaurantId, id, restaurantId]);
  await transaction(async (conn) => {
    await query('DELETE FROM categories WHERE id = ? AND restaurant_id = ?', [id, restaurantId], conn);
  });
  await logActivity({ restaurantId, userId, action: 'category.deleted', entity: 'category', entityId: id, meta: { name: cat.name, products: Number(cat.product_count) }, ip });
  destroyOwned(restaurantId, [cat.image_public_id, ...imgs.map((i) => i.public_id)].filter(Boolean));
}

export async function reorder(restaurantId, userId, ids, ip) {
  const unique = [...new Set(ids)];
  const rows = await query(`SELECT id FROM categories WHERE restaurant_id = ? AND id IN (${unique.map(() => '?').join(',')})`, [restaurantId, ...unique]);
  if (rows.length !== unique.length) throw badRequest('Catégorie inconnue dans la liste.');
  await transaction(async (conn) => {
    for (let i = 0; i < unique.length; i++) {
      await query('UPDATE categories SET sort_order = ? WHERE id = ? AND restaurant_id = ?', [i + 1, unique[i], restaurantId], conn);
    }
  });
  await logActivity({ restaurantId, userId, action: 'category.reordered', entity: 'category', ip });
  return list(restaurantId);
}

export async function setImage(restaurantId, userId, id, file, ip) {
  const cat = await getOwned(restaurantId, id);
  const { url, publicId } = await storage.upload(file.buffer, { folder: folderFor(restaurantId, 'categories') });
  try {
    await query('UPDATE categories SET image_url = ?, image_public_id = ? WHERE id = ? AND restaurant_id = ?', [url, publicId, id, restaurantId]);
  } catch (err) {
    destroyOwned(restaurantId, [publicId]);
    throw err;
  }
  if (cat.image_public_id) destroyOwned(restaurantId, [cat.image_public_id]);
  await logActivity({ restaurantId, userId, action: 'category.image_updated', entity: 'category', entityId: id, ip });
  return toApi(await getOwned(restaurantId, id));
}

export async function removeImage(restaurantId, userId, id, ip) {
  const cat = await getOwned(restaurantId, id);
  await query('UPDATE categories SET image_url = NULL, image_public_id = NULL WHERE id = ? AND restaurant_id = ?', [id, restaurantId]);
  if (cat.image_public_id) destroyOwned(restaurantId, [cat.image_public_id]);
  await logActivity({ restaurantId, userId, action: 'category.image_removed', entity: 'category', entityId: id, ip });
  return toApi(await getOwned(restaurantId, id));
}
