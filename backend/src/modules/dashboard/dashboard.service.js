import { query, queryOne } from '../../config/db.js';

const DAY_MS = 86_400_000;
const ymd = (d) => d.toISOString().slice(0, 10);

/** Toutes les requêtes sont filtrées par restaurant_id (fourni par le middleware tenant, jamais par le client). */
export async function getDashboard(restaurantId) {
  const since = new Date(Date.now() - 6 * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);

  const [restaurant, products, categories, views, perDay, activity] = await Promise.all([
    queryOne('SELECT id, name, slug FROM restaurants WHERE id = ?', [restaurantId]),
    queryOne(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(is_active = 1 AND is_available = 1), 0) AS available,
              COALESCE(SUM(is_active = 1 AND is_available = 0), 0) AS unavailable
         FROM products WHERE restaurant_id = ?`,
      [restaurantId]
    ),
    queryOne('SELECT COUNT(*) AS total FROM categories WHERE restaurant_id = ?', [restaurantId]),
    queryOne('SELECT COUNT(*) AS total FROM menu_views WHERE restaurant_id = ?', [restaurantId]),
    query(
      `SELECT DATE_FORMAT(viewed_at, '%Y-%m-%d') AS day, COUNT(*) AS n
         FROM menu_views WHERE restaurant_id = ? AND viewed_at >= ? GROUP BY day`,
      [restaurantId, since]
    ),
    query(
      `SELECT al.id, al.action, al.entity, al.created_at, u.name AS user_name
         FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id
        WHERE al.restaurant_id = ? ORDER BY al.id DESC LIMIT 10`,
      [restaurantId]
    ),
  ]);

  const counts = new Map(perDay.map((r) => [r.day, Number(r.n)]));
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = ymd(new Date(since.getTime() + i * DAY_MS));
    return { day, views: counts.get(day) ?? 0 };
  });

  return {
    restaurant,
    products: {
      total: Number(products.total),
      available: Number(products.available),
      unavailable: Number(products.unavailable),
    },
    categories: Number(categories.total),
    views: { total: Number(views.total), last7Days },
    recentActivity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      userName: a.user_name,
      createdAt: new Date(a.created_at).toISOString(),
    })),
  };
}

export async function getSubscriptionHistory(restaurantId) {
  const rows = await query(
    `SELECT s.id, s.status, s.starts_at, s.ends_at, p.code AS plan_code, p.name AS plan_name,
            COALESCE((SELECT SUM(amount_dt) FROM subscription_payments sp
                       WHERE sp.subscription_id = s.id AND sp.restaurant_id = s.restaurant_id), 0) AS paid_dt
       FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.restaurant_id = ? ORDER BY s.id DESC LIMIT 50`,
    [restaurantId]
  );
  const now = Date.now();
  return rows.map((r) => {
    const ends = new Date(r.ends_at);
    const expiredByDate = (r.status === 'trial' || r.status === 'active') && ends.getTime() <= now;
    return {
      id: r.id,
      status: expiredByDate ? 'expired' : r.status,
      planCode: r.plan_code,
      planName: r.plan_name,
      startsAt: new Date(r.starts_at).toISOString(),
      endsAt: ends.toISOString(),
      paidDt: Number(r.paid_dt),
    };
  });
}
