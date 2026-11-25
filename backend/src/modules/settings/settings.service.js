import { query, queryOne, transaction } from '../../config/db.js';
import { notFound } from '../../utils/errors.js';
import { parseJson } from '../../utils/common.js';
import { logActivity } from '../../utils/activity.js';
import { destroyOwned, folderFor, storage } from '../../services/storage.js';

const toApi = (r) => ({
  name: r.name,
  slug: r.slug,
  logoUrl: r.logo_url,
  coverUrl: r.cover_url,
  description: r.description,
  address: r.address,
  phone: r.phone,
  openingHours: parseJson(r.opening_hours, null),
  socialLinks: parseJson(r.social_links, {}),
  currency: r.currency,
  primaryColor: r.primary_color,
  secondaryColor: r.secondary_color,
});

const SQL = `SELECT r.name, r.slug, s.* FROM restaurants r JOIN restaurant_settings s ON s.restaurant_id = r.id WHERE r.id = ?`;

export async function get(restaurantId) {
  const row = await queryOne(SQL, [restaurantId]);
  if (!row) throw notFound('Paramètres introuvables.');
  return toApi(row);
}

export async function update(restaurantId, userId, data, ip) {
  await transaction(async (conn) => {
    if (data.name !== undefined) await query('UPDATE restaurants SET name = ? WHERE id = ?', [data.name, restaurantId], conn);
    const map = { description: 'description', address: 'address', phone: 'phone', primaryColor: 'primary_color', secondaryColor: 'secondary_color' };
    const sets = [];
    const params = [];
    for (const [k, col] of Object.entries(map)) if (data[k] !== undefined) { sets.push(`${col} = ?`); params.push(data[k]); }
    // Le slug (donc l'URL publique et le QR Code) ne change jamais quand le nom est modifié
    if (data.openingHours !== undefined) { sets.push('opening_hours = ?'); params.push(data.openingHours ? JSON.stringify(data.openingHours) : null); }
    if (data.socialLinks !== undefined) { sets.push('social_links = ?'); params.push(data.socialLinks ? JSON.stringify(data.socialLinks) : null); }
    if (sets.length) await query(`UPDATE restaurant_settings SET ${sets.join(', ')} WHERE restaurant_id = ?`, [...params, restaurantId], conn);
  });
  await logActivity({ restaurantId, userId, action: 'settings.updated', entity: 'restaurant', entityId: restaurantId, ip });
  return get(restaurantId);
}

const KIND = {
  logo: { url: 'logo_url', pid: 'logo_public_id', folder: 'branding' },
  cover: { url: 'cover_url', pid: 'cover_public_id', folder: 'branding' },
};

export async function setImage(restaurantId, userId, kind, file, ip) {
  const k = KIND[kind];
  const old = await queryOne(`SELECT ${k.pid} AS pid FROM restaurant_settings WHERE restaurant_id = ?`, [restaurantId]);
  const { url, publicId } = await storage.upload(file.buffer, { folder: folderFor(restaurantId, k.folder) });
  try {
    await query(`UPDATE restaurant_settings SET ${k.url} = ?, ${k.pid} = ? WHERE restaurant_id = ?`, [url, publicId, restaurantId]);
  } catch (err) {
    destroyOwned(restaurantId, [publicId]);
    throw err;
  }
  if (old?.pid) destroyOwned(restaurantId, [old.pid]);
  await logActivity({ restaurantId, userId, action: `settings.${kind}_updated`, entity: 'restaurant', entityId: restaurantId, ip });
  return get(restaurantId);
}

export async function removeImage(restaurantId, userId, kind, ip) {
  const k = KIND[kind];
  const old = await queryOne(`SELECT ${k.pid} AS pid FROM restaurant_settings WHERE restaurant_id = ?`, [restaurantId]);
  await query(`UPDATE restaurant_settings SET ${k.url} = NULL, ${k.pid} = NULL WHERE restaurant_id = ?`, [restaurantId]);
  if (old?.pid) destroyOwned(restaurantId, [old.pid]);
  await logActivity({ restaurantId, userId, action: `settings.${kind}_removed`, entity: 'restaurant', entityId: restaurantId, ip });
  return get(restaurantId);
}
