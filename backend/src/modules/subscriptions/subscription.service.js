import { query, queryOne } from '../../config/db.js';

const DAY_MS = 86_400_000;

/**
 * Abonnement courant d'un restaurant, avec statut EFFECTIF calculé côté serveur :
 * un abonnement trial/active dont la date de fin est dépassée est considéré comme expiré,
 * même si la ligne n'a pas encore été mise à jour en base.
 */
export async function getAccessState(restaurantId, conn) {
  const sub = await queryOne(
    `SELECT s.id, s.status, s.starts_at, s.ends_at, p.code AS plan_code, p.name AS plan_name, p.price_dt
       FROM subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.restaurant_id = ?
      ORDER BY s.id DESC
      LIMIT 1`,
    [restaurantId],
    conn
  );

  if (!sub) {
    return { status: 'expired', planCode: null, planName: null, startsAt: null, endsAt: null, daysLeft: 0, canWrite: false, subscriptionId: null };
  }

  const now = Date.now();
  const endsAt = new Date(sub.ends_at);
  let status = sub.status;
  if ((status === 'trial' || status === 'active') && endsAt.getTime() <= now) status = 'expired';

  // Synchronise la base quand l'expiration vient d'être constatée (échec silencieux : le calcul reste correct)
  if (status === 'expired' && sub.status !== 'expired') {
    query(`UPDATE subscriptions SET status = 'expired' WHERE id = ? AND status IN ('trial','active')`, [sub.id], conn).catch(() => {});
  }

  const daysLeft = status === 'trial' || status === 'active' ? Math.max(0, Math.ceil((endsAt.getTime() - now) / DAY_MS)) : 0;

  return {
    subscriptionId: sub.id,
    status,
    planCode: sub.plan_code,
    planName: sub.plan_name,
    priceDt: sub.price_dt,
    startsAt: new Date(sub.starts_at).toISOString(),
    endsAt: endsAt.toISOString(),
    daysLeft,
    canWrite: status === 'trial' || status === 'active',
  };
}
