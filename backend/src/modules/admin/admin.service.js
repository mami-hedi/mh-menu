import { query, queryOne, transaction } from '../../config/db.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { logActivity } from '../../utils/activity.js';
import { sendEmail } from '../../utils/mailer.js';

const DAY = 86_400_000;
const PAGE_SIZE = 20;

// Statut EFFECTIF d'un abonnement (même règle que getAccessState) ; le paramètre est l'instant courant fourni par Node
const EFF = `CASE WHEN s.status IN ('trial','active') AND s.ends_at <= ? THEN 'expired' ELSE s.status END`;
// Compatible TiDB : pas de sous-requête dans une condition ON, on passe par des tables dérivées.
const latestSubJoin = (type) => `${type} JOIN (SELECT restaurant_id, MAX(id) AS id FROM subscriptions GROUP BY restaurant_id) ls ON ls.restaurant_id = r.id ${type} JOIN subscriptions s ON s.id = ls.id`;
const OWNER_JOIN = `LEFT JOIN (SELECT restaurant_id, MIN(id) AS id FROM users WHERE role = 'owner' AND restaurant_id IS NOT NULL GROUP BY restaurant_id) ow ON ow.restaurant_id = r.id LEFT JOIN users o ON o.id = ow.id`;

const iso = (d) => (d ? new Date(d).toISOString() : null);
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

export async function stats() {
  const now = new Date();
  const [byStatus, totals, expiring, revenue, monthly, tickets] = await Promise.all([
    query(`SELECT ${EFF} AS st, COUNT(*) AS n FROM restaurants r ${latestSubJoin('')} GROUP BY st`, [now]),
    queryOne(`SELECT COUNT(*) AS total, SUM(status = 'suspended') AS suspended, SUM(created_at >= ?) AS new7, SUM(created_at >= ?) AS new30 FROM restaurants`, [new Date(+now - 7 * DAY), new Date(+now - 30 * DAY)]),
    queryOne(`SELECT COUNT(*) AS n FROM restaurants r ${latestSubJoin('')} WHERE s.status IN ('trial','active') AND s.ends_at > ? AND s.ends_at <= ?`, [now, new Date(+now + 3 * DAY)]),
    queryOne(`SELECT COALESCE(SUM(amount_dt), 0) AS total, COALESCE(SUM(CASE WHEN paid_at >= ? THEN amount_dt END), 0) AS month FROM subscription_payments`, [startOfMonth(now)]),
    query(`SELECT DATE_FORMAT(paid_at, '%Y-%m') AS ym, SUM(amount_dt) AS total FROM subscription_payments WHERE paid_at >= ? GROUP BY ym ORDER BY ym`, [new Date(now.getFullYear(), now.getMonth() - 5, 1)]),
    queryOne(`SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('open','in_progress')`),
  ]);
  const count = (s) => Number(byStatus.find((x) => x.st === s)?.n ?? 0);
  // 6 derniers mois, y compris les mois sans paiement
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: ym, total: Number(monthly.find((m) => m.ym === ym)?.total ?? 0) });
  }
  return {
    restaurants: { total: Number(totals.total), suspended: Number(totals.suspended ?? 0), new7Days: Number(totals.new7 ?? 0), new30Days: Number(totals.new30 ?? 0) },
    subscriptions: { trial: count('trial'), active: count('active'), expired: count('expired'), cancelled: count('cancelled'), expiringSoon: Number(expiring.n) },
    revenue: { totalDt: Number(revenue.total), thisMonthDt: Number(revenue.month), months },
    openTickets: Number(tickets.n),
  };
}

const FILTERS = {
  trial: `${EFF} = 'trial'`,
  active: `${EFF} = 'active'`,
  expired: `${EFF} = 'expired'`,
  cancelled: `${EFF} = 'cancelled'`,
  suspended: `r.status = 'suspended'`,
  expiring: `s.status IN ('trial','active') AND s.ends_at > ? AND s.ends_at <= ?`,
};

export async function listRestaurants({ filter, q, page = 1 }) {
  const now = new Date();
  const where = ['1 = 1'];
  const params = [];
  if (filter) {
    where.push(FILTERS[filter]);
    if (filter === 'expiring') params.push(now, new Date(+now + 3 * DAY));
    else if (filter !== 'suspended') params.push(now);
  }
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(r.name LIKE ? ESCAPE '\\\\' OR r.slug LIKE ? ESCAPE '\\\\' OR o.email LIKE ? ESCAPE '\\\\' OR o.name LIKE ? ESCAPE '\\\\')`);
    params.push(like, like, like, like);
  }
  const from = `FROM restaurants r ${latestSubJoin('LEFT')} LEFT JOIN subscription_plans p ON p.id = s.plan_id ${OWNER_JOIN} WHERE ${where.join(' AND ')}`;
  const total = Number((await queryOne(`SELECT COUNT(*) AS n ${from}`, params)).n);
  const rows = await query(
    `SELECT r.id, r.name, r.slug, r.status, r.created_at, s.ends_at, p.name AS plan_name, ${EFF} AS effective_status,
            o.name AS owner_name, o.email AS owner_email, o.phone AS owner_phone,
            (SELECT COUNT(*) FROM products WHERE restaurant_id = r.id) AS products
       ${from} ORDER BY r.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    [now, ...params]
  );
  return {
    page, pageSize: PAGE_SIZE, total,
    items: rows.map((r) => ({
      id: r.id, name: r.name, slug: r.slug, suspended: r.status === 'suspended', createdAt: iso(r.created_at),
      subscriptionStatus: r.effective_status, planName: r.plan_name, endsAt: iso(r.ends_at),
      owner: { name: r.owner_name, email: r.owner_email, phone: r.owner_phone }, products: Number(r.products),
    })),
  };
}

export async function getRestaurant(id) {
  const now = new Date();
  const r = await queryOne(`SELECT id, name, slug, status, created_at FROM restaurants WHERE id = ?`, [id]);
  if (!r) throw notFound('Restaurant introuvable.');
  const [users, subs, payments, counts, activity] = await Promise.all([
    query(`SELECT id, name, email, phone, role, is_active, last_login_at FROM users WHERE restaurant_id = ? ORDER BY id`, [id]),
    query(
      `SELECT s.id, s.status, s.starts_at, s.ends_at, s.notes, p.name AS plan_name, ${EFF} AS effective_status
         FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.restaurant_id = ? ORDER BY s.id DESC LIMIT 50`,
      [now, id]
    ),
    query(`SELECT id, subscription_id, amount_dt, method, reference, paid_at FROM subscription_payments WHERE restaurant_id = ? ORDER BY paid_at DESC, id DESC LIMIT 50`, [id]),
    queryOne(
      `SELECT (SELECT COUNT(*) FROM products WHERE restaurant_id = ?) AS products, (SELECT COUNT(*) FROM categories WHERE restaurant_id = ?) AS categories,
              (SELECT COUNT(*) FROM menu_views WHERE restaurant_id = ?) AS views`,
      [id, id, id]
    ),
    query(`SELECT a.id, a.action, a.created_at, u.name AS user_name FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id WHERE a.restaurant_id = ? ORDER BY a.id DESC LIMIT 10`, [id]),
  ]);
  return {
    id: r.id, name: r.name, slug: r.slug, suspended: r.status === 'suspended', createdAt: iso(r.created_at),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, isActive: !!u.is_active, lastLoginAt: iso(u.last_login_at) })),
    subscriptions: subs.map((s) => ({ id: s.id, status: s.effective_status, planName: s.plan_name, startsAt: iso(s.starts_at), endsAt: iso(s.ends_at), notes: s.notes })),
    payments: payments.map((p) => ({ id: p.id, subscriptionId: p.subscription_id, amountDt: Number(p.amount_dt), method: p.method, reference: p.reference, paidAt: iso(p.paid_at) })),
    counts: { products: Number(counts.products), categories: Number(counts.categories), views: Number(counts.views) },
    recentActivity: activity.map((a) => ({ id: a.id, action: a.action, userName: a.user_name, createdAt: iso(a.created_at) })),
  };
}

const lockRestaurant = async (conn, id) => {
  const r = await queryOne('SELECT id, name FROM restaurants WHERE id = ? FOR UPDATE', [id], conn);
  if (!r) throw notFound('Restaurant introuvable.');
  return r;
};
const latestSub = (conn, id) => queryOne('SELECT id, status, starts_at, ends_at FROM subscriptions WHERE restaurant_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE', [id], conn);
const isLive = (s, now) => s && (s.status === 'trial' || s.status === 'active') && new Date(s.ends_at) > now;

/** Active ou renouvelle un abonnement payant et enregistre le paiement reçu (saisie manuelle par le Super Admin). */
export async function activate(restaurantId, adminId, { planCode, amountDt, method, reference, paidAt, notes }, ip) {
  const result = await transaction(async (conn) => {
    await lockRestaurant(conn, restaurantId);
    const plan = await queryOne(`SELECT id, name, price_dt, duration_days FROM subscription_plans WHERE code = ? AND is_public = 1`, [planCode], conn);
    if (!plan) throw badRequest('Offre inconnue.');
    const now = new Date();
    const paid = paidAt ? new Date(paidAt) : now;
    if (paid > new Date(+now + 60_000)) throw badRequest('La date de paiement ne peut pas être dans le futur.');
    const cur = await latestSub(conn, restaurantId);
    let subId;
    let renewal = false;
    if (cur?.status === 'active' && new Date(cur.ends_at) > now) {
      // Renouvellement : la durée s'ajoute à la fin de l'abonnement en cours (rien n'est perdu)
      const ends = new Date(+new Date(cur.ends_at) + plan.duration_days * DAY);
      await query('UPDATE subscriptions SET plan_id = ?, ends_at = ?, activated_by = ?, notes = ? WHERE id = ? AND restaurant_id = ?', [plan.id, ends, adminId, notes ?? null, cur.id, restaurantId], conn);
      subId = cur.id; renewal = true;
    } else {
      if (cur && (cur.status === 'trial' || cur.status === 'active')) await query(`UPDATE subscriptions SET status = 'expired' WHERE id = ? AND restaurant_id = ?`, [cur.id, restaurantId], conn);
      const ins = await query(
        `INSERT INTO subscriptions (restaurant_id, plan_id, status, starts_at, ends_at, activated_by, notes) VALUES (?, ?, 'active', ?, ?, ?, ?)`,
        [restaurantId, plan.id, now, new Date(+now + plan.duration_days * DAY), adminId, notes ?? null],
        conn
      );
      subId = ins.insertId;
    }
    await query(
      `INSERT INTO subscription_payments (restaurant_id, subscription_id, amount_dt, method, reference, paid_at, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [restaurantId, subId, amountDt ?? plan.price_dt, method, reference ?? null, paid, adminId],
      conn
    );
    return { subscriptionId: subId, renewal, planName: plan.name };
  });
  await logActivity({ restaurantId, userId: adminId, action: result.renewal ? 'subscription.renewed' : 'subscription.activated', entity: 'subscription', entityId: result.subscriptionId, meta: { plan: planCode }, ip });
  notifyOwner(restaurantId, 'Votre abonnement MH Menu est actif', `Votre abonnement « ${result.planName} » est activé. Merci pour votre confiance.`);
  return getRestaurant(restaurantId);
}

/** Offre des jours gratuits : prolonge l'abonnement en cours ou ouvre une nouvelle période d'essai. */
export async function grantDays(restaurantId, adminId, { days, notes }, ip) {
  const subId = await transaction(async (conn) => {
    await lockRestaurant(conn, restaurantId);
    const now = new Date();
    const cur = await latestSub(conn, restaurantId);
    if (isLive(cur, now)) {
      await query('UPDATE subscriptions SET ends_at = ?, notes = COALESCE(?, notes) WHERE id = ? AND restaurant_id = ?', [new Date(+new Date(cur.ends_at) + days * DAY), notes ?? null, cur.id, restaurantId], conn);
      return cur.id;
    }
    const plan = await queryOne(`SELECT id FROM subscription_plans WHERE code = 'trial'`, [], conn);
    const r = await query(
      `INSERT INTO subscriptions (restaurant_id, plan_id, status, starts_at, ends_at, activated_by, notes) VALUES (?, ?, 'trial', ?, ?, ?, ?)`,
      [restaurantId, plan.id, now, new Date(+now + days * DAY), adminId, notes ?? null],
      conn
    );
    return r.insertId;
  });
  await logActivity({ restaurantId, userId: adminId, action: 'subscription.extended', entity: 'subscription', entityId: subId, meta: { days }, ip });
  return getRestaurant(restaurantId);
}

export async function cancel(restaurantId, adminId, { notes }, ip) {
  const subId = await transaction(async (conn) => {
    await lockRestaurant(conn, restaurantId);
    const cur = await latestSub(conn, restaurantId);
    if (!cur || (cur.status !== 'trial' && cur.status !== 'active')) throw conflict('Aucun abonnement en cours à annuler.');
    await query(`UPDATE subscriptions SET status = 'cancelled', notes = COALESCE(?, notes) WHERE id = ? AND restaurant_id = ?`, [notes ?? null, cur.id, restaurantId], conn);
    return cur.id;
  });
  await logActivity({ restaurantId, userId: adminId, action: 'subscription.cancelled', entity: 'subscription', entityId: subId, ip });
  return getRestaurant(restaurantId);
}

export async function setSuspended(restaurantId, adminId, suspended, ip) {
  const r = await query('UPDATE restaurants SET status = ? WHERE id = ?', [suspended ? 'suspended' : 'active', restaurantId]);
  if (!r.affectedRows) throw notFound('Restaurant introuvable.');
  await logActivity({ restaurantId, userId: adminId, action: suspended ? 'restaurant.suspended' : 'restaurant.reactivated', entity: 'restaurant', entityId: restaurantId, ip });
  return getRestaurant(restaurantId);
}

export async function listPayments(page = 1) {
  const total = Number((await queryOne('SELECT COUNT(*) AS n FROM subscription_payments')).n);
  const rows = await query(
    `SELECT sp.id, sp.restaurant_id, r.name AS restaurant_name, sp.amount_dt, sp.method, sp.reference, sp.paid_at, p.name AS plan_name
       FROM subscription_payments sp
       JOIN restaurants r ON r.id = sp.restaurant_id
       JOIN subscriptions s ON s.id = sp.subscription_id AND s.restaurant_id = sp.restaurant_id
       JOIN subscription_plans p ON p.id = s.plan_id
      ORDER BY sp.paid_at DESC, sp.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`
  );
  return {
    page, pageSize: PAGE_SIZE, total,
    items: rows.map((p) => ({ id: p.id, restaurantId: p.restaurant_id, restaurantName: p.restaurant_name, planName: p.plan_name, amountDt: Number(p.amount_dt), method: p.method, reference: p.reference, paidAt: iso(p.paid_at) })),
  };
}

// --- Support ---
export async function listTickets({ status, page = 1 }) {
  const where = status ? 'WHERE t.status = ?' : '';
  const params = status ? [status] : [];
  const total = Number((await queryOne(`SELECT COUNT(*) AS n FROM support_tickets t ${where}`, params)).n);
  const rows = await query(
    `SELECT t.id, t.restaurant_id, r.name AS restaurant_name, t.subject, t.status, t.created_at, t.updated_at, (t.admin_reply IS NOT NULL) AS replied
       FROM support_tickets t JOIN restaurants r ON r.id = t.restaurant_id ${where}
      ORDER BY FIELD(t.status, 'open', 'in_progress', 'resolved', 'closed'), t.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    params
  );
  return { page, pageSize: PAGE_SIZE, total, items: rows.map((t) => ({ id: t.id, restaurantId: t.restaurant_id, restaurantName: t.restaurant_name, subject: t.subject, status: t.status, replied: !!t.replied, createdAt: iso(t.created_at), updatedAt: iso(t.updated_at) })) };
}

export async function getTicket(id) {
  const t = await queryOne(
    `SELECT t.*, r.name AS restaurant_name, u.name AS user_name, u.email AS user_email FROM support_tickets t
       JOIN restaurants r ON r.id = t.restaurant_id LEFT JOIN users u ON u.id = t.user_id WHERE t.id = ?`, [id]);
  if (!t) throw notFound('Demande introuvable.');
  return { id: t.id, restaurantId: t.restaurant_id, restaurantName: t.restaurant_name, userName: t.user_name, userEmail: t.user_email, subject: t.subject, message: t.message, status: t.status, adminReply: t.admin_reply, createdAt: iso(t.created_at), updatedAt: iso(t.updated_at) };
}

export async function updateTicket(id, adminId, { status, adminReply }, ip) {
  const t = await queryOne('SELECT id, restaurant_id, subject FROM support_tickets WHERE id = ?', [id]);
  if (!t) throw notFound('Demande introuvable.');
  const sets = []; const params = [];
  if (status) { sets.push('status = ?'); params.push(status); }
  if (adminReply !== undefined) { sets.push('admin_reply = ?'); params.push(adminReply); }
  if (sets.length) await query(`UPDATE support_tickets SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  if (adminReply) {
    await logActivity({ restaurantId: t.restaurant_id, userId: adminId, action: 'ticket.replied', entity: 'support_ticket', entityId: id, ip });
    notifyOwner(t.restaurant_id, `Réponse à votre demande : ${t.subject}`, adminReply);
  }
  return getTicket(id);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Email au propriétaire (Resend). Un échec d'envoi ne doit jamais faire échouer l'action. */
function notifyOwner(restaurantId, subject, text) {
  queryOne(`SELECT name, email FROM users WHERE restaurant_id = ? AND role = 'owner' AND is_active = 1 ORDER BY id LIMIT 1`, [restaurantId])
    .then((o) => o && sendEmail({ to: o.email, subject, html: `<div style="font-family:Arial,sans-serif;color:#0b1f4b"><p>Bonjour ${esc(o.name)},</p><p style="white-space:pre-line;line-height:1.6">${esc(text)}</p><p style="font-size:12px;color:#7a869a">MH Menu – MH Digital Solution</p></div>` }))
    .catch((e) => console.error('[admin] email non envoyé :', e.message));
}