import mysql from 'mysql2/promise';
import { env } from './env.js';

// Dates stockées et lues en UTC. TiDB Cloud impose TLS.
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  charset: 'utf8mb4',
  decimalNumbers: true,
  namedPlaceholders: false,
});

// Requêtes toujours préparées (paramètres liés) : pas de concaténation SQL.
export async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = [], conn = pool) {
  const rows = await query(sql, params, conn);
  return rows[0] ?? null;
}

export async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* connexion déjà perdue */
    }
    throw err;
  } finally {
    conn.release();
  }
}
