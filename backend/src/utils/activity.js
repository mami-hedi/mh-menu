import { query } from '../config/db.js';

/**
 * Journalise une action importante. Ne doit jamais faire échouer la requête principale.
 * `conn` permet de l'inclure dans une transaction.
 */
export async function logActivity(
  { restaurantId = null, userId = null, action, entity = null, entityId = null, meta = null, ip = null },
  conn
) {
  try {
    await query(
      `INSERT INTO activity_logs (restaurant_id, user_id, action, entity, entity_id, meta, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [restaurantId, userId, action, entity, entityId, meta ? JSON.stringify(meta) : null, ip],
      conn
    );
  } catch (err) {
    console.error('[activity] échec de journalisation :', err.message);
  }
}
