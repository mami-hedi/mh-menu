import { query, queryOne } from '../../config/db.js';
import { parseJson } from '../../utils/common.js';

const PAYMENT_KEY = 'payment_info';
const EMPTY = { instructions: null, bankName: null, accountHolder: null, rib: null, d17: null, flouci: null, contactPhone: null, contactEmail: null };

/** Coordonnées de paiement (virement, D17, Flouci…) affichées aux restaurants sur la page Abonnement. */
export async function getPaymentInfo() {
  const row = await queryOne('SELECT setting_value, updated_at FROM platform_settings WHERE setting_key = ?', [PAYMENT_KEY]);
  const value = parseJson(row?.setting_value, {});
  return { ...EMPTY, ...value, updatedAt: row ? new Date(row.updated_at).toISOString() : null };
}

export async function setPaymentInfo(data, userId) {
  const clean = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] ?? null]));
  await query(
    `INSERT INTO platform_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [PAYMENT_KEY, JSON.stringify(clean), userId]
  );
  return getPaymentInfo();
}
