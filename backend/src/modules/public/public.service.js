import crypto from 'node:crypto';
import { query, queryOne } from '../../config/db.js';
import { env } from '../../config/env.js';
import { notFound, forbidden } from '../../utils/errors.js';
import { parseJson } from '../../utils/common.js';
import { getAccessState } from '../subscriptions/subscription.service.js';

/** Restaurant visible publiquement, ou erreur. Aucune donnée interne n'est exposée. */
async function loadPublicRestaurant(slug) {
  const r = await queryOne(
    `SELECT r.id, r.name, r.slug, r.status, s.logo_url, s.cover_url, s.description, s.address, s.phone, s.opening_hours,
            s.social_links, s.currency, s.primary_color, s.secondary_color,
            m.template, m.cart_enabled, m.is_published, m.allow_indexing, m.show_popular
       FROM restaurants r
       JOIN restaurant_settings s ON s.restaurant_id = r.id
       JOIN menus m ON m.restaurant_id = r.id
      WHERE r.slug = ?`,
    [slug]
  );
  if (!r) throw notFound('Ce menu est introuvable.');
  return r;
}

/** Vérifie que le menu peut être affiché (restaurant actif, publié, abonnement valide). */
async function assertVisible(r) {
  const unavailable = () => forbidden('Ce menu est momentanément indisponible.', 'MENU_UNAVAILABLE');
  if (r.status !== 'active' || !r.is_published) throw unavailable();
  const access = await getAccessState(r.id);
  if (!access.canWrite) throw unavailable();
}

const effectivePrice = (p) => (p.is_promo && p.promo_price != null ? p.promo_price : p.price);

export async function getPublicMenu(slug, tableLabel) {
  const r = await loadPublicRestaurant(slug);
  await assertVisible(r);

  const [categories, products, images, variants, extras] = await Promise.all([
    query('SELECT id, name, description, image_url FROM categories WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order, id', [r.id]),
    query(
      `SELECT id, category_id, name, description, price, promo_price, is_promo, is_available, is_popular
         FROM products WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order, id`,
      [r.id]
    ),
    query('SELECT product_id, url FROM product_images WHERE restaurant_id = ? ORDER BY sort_order, id', [r.id]),
    query('SELECT id, product_id, name, price_delta, is_default FROM product_variants WHERE restaurant_id = ? ORDER BY sort_order, id', [r.id]),
    query('SELECT id, product_id, name, price, is_required FROM product_extras WHERE restaurant_id = ? ORDER BY sort_order, id', [r.id]),
  ]);

  const group = (rows) => rows.reduce((m, x) => ((m[x.product_id] ??= []).push(x), m), {});
  const imgBy = group(images), varBy = group(variants), extBy = group(extras);
  const prodBy = group(products.map((p) => ({ ...p, product_id: p.category_id })));

  let table = null;
  if (tableLabel) {
    const t = await queryOne('SELECT table_label FROM qr_codes WHERE restaurant_id = ? AND table_label = ?', [r.id, tableLabel]);
    table = t?.table_label ?? null;
  }

  return {
    restaurant: {
      name: r.name, slug: r.slug, logoUrl: r.logo_url, coverUrl: r.cover_url, description: r.description,
      address: r.address, phone: r.phone, openingHours: parseJson(r.opening_hours, null), socialLinks: parseJson(r.social_links, {}),
      currency: r.currency, primaryColor: r.primary_color, secondaryColor: r.secondary_color,
    },
    menu: { template: r.template, cartEnabled: !!r.cart_enabled, allowIndexing: !!r.allow_indexing },
    table,
    // Les catégories vides sont masquées côté public
    categories: categories
      .map((c) => ({
        id: c.id, name: c.name, description: c.description, imageUrl: c.image_url,
        products: (prodBy[c.id] ?? []).map((p) => ({
          id: p.id, name: p.name, description: p.description,
          price: p.price, promoPrice: p.is_promo && p.promo_price != null ? p.promo_price : null,
          finalPrice: effectivePrice(p),
          isAvailable: !!p.is_available,
          isPopular: !!r.show_popular && !!p.is_popular,
          images: (imgBy[p.id] ?? []).map((i) => i.url),
          variants: (varBy[p.id] ?? []).map((v) => ({ id: v.id, name: v.name, priceDelta: v.price_delta, isDefault: !!v.is_default })),
          extras: (extBy[p.id] ?? []).map((e) => ({ id: e.id, name: e.name, price: e.price, isRequired: !!e.is_required })),
        })),
      }))
      .filter((c) => c.products.length > 0),
  };
}

/**
 * Enregistre une consultation. Aucune donnée personnelle : le visiteur est un hash salé (IP + navigateur + jour)
 * impossible à relier à une personne, et une même personne n'est comptée qu'une fois par demi-heure.
 */
export async function recordView(slug, { ip, userAgent, tableLabel }) {
  const r = await loadPublicRestaurant(slug);
  await assertVisible(r);
  const day = new Date().toISOString().slice(0, 10);
  const hash = crypto.createHash('sha256').update(`${env.jwt.secret}|${day}|${ip}|${userAgent ?? ''}`).digest('hex');
  const recent = await queryOne(
    `SELECT id FROM menu_views WHERE restaurant_id = ? AND visitor_hash = ? AND viewed_at > ? LIMIT 1`,
    [r.id, hash, new Date(Date.now() - 30 * 60_000)]
  );
  if (recent) return { counted: false };
  let table = null;
  if (tableLabel) table = (await queryOne('SELECT table_label FROM qr_codes WHERE restaurant_id = ? AND table_label = ?', [r.id, tableLabel]))?.table_label ?? null;
  await query('INSERT INTO menu_views (restaurant_id, viewed_at, table_label, visitor_hash) VALUES (?, ?, ?, ?)', [r.id, new Date(), table, hash]);
  return { counted: true };
}
