import { query } from '../../config/db.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
// La Tunisie est en UTC+1 toute l'année (pas d'heure d'été). Les vues sont stockées en UTC.
const TZ_OFFSET_H = 1;
const ymd = (d) => d.toISOString().slice(0, 10);

export const RANGES = [7, 30, 90];

/** Début (UTC) du jour local tunisien `daysBack` jours avant aujourd'hui. */
function localDayStart(daysBack) {
  const local = new Date(Date.now() + TZ_OFFSET_H * HOUR_MS);
  local.setUTCHours(0, 0, 0, 0);
  return { local: new Date(local.getTime() - daysBack * DAY_MS), utc: new Date(local.getTime() - daysBack * DAY_MS - TZ_OFFSET_H * HOUR_MS) };
}

/** Statistiques de fréquentation du menu public. Filtrées par restaurant_id (fourni par le middleware tenant). */
export async function getStats(restaurantId, days) {
  const cur = localDayStart(days - 1);
  const prev = localDayStart(2 * days - 1);
  const shifted = `DATE_ADD(viewed_at, INTERVAL ${TZ_OFFSET_H} HOUR)`; // constante interne, jamais issue du client

  const [perDay, byHour, byTable, previous] = await Promise.all([
    query(
      `SELECT DATE_FORMAT(${shifted}, '%Y-%m-%d') AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
         FROM menu_views WHERE restaurant_id = ? AND viewed_at >= ? GROUP BY day`,
      [restaurantId, cur.utc]
    ),
    query(
      `SELECT HOUR(${shifted}) AS h, COUNT(*) AS n FROM menu_views WHERE restaurant_id = ? AND viewed_at >= ? GROUP BY h`,
      [restaurantId, cur.utc]
    ),
    query(
      `SELECT table_label, COUNT(*) AS n FROM menu_views WHERE restaurant_id = ? AND viewed_at >= ? GROUP BY table_label ORDER BY n DESC`,
      [restaurantId, cur.utc]
    ),
    query(
      `SELECT COUNT(*) AS n FROM menu_views WHERE restaurant_id = ? AND viewed_at >= ? AND viewed_at < ?`,
      [restaurantId, prev.utc, cur.utc]
    ),
  ]);

  const map = new Map(perDay.map((r) => [r.day, r]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = ymd(new Date(cur.local.getTime() + i * DAY_MS));
    const r = map.get(day);
    return { day, views: Number(r?.views ?? 0), visitors: Number(r?.visitors ?? 0) };
  });
  const total = series.reduce((s, d) => s + d.views, 0);
  const visitors = series.reduce((s, d) => s + d.visitors, 0);
  const previousTotal = Number(previous[0]?.n ?? 0);

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: Number(byHour.find((r) => Number(r.h) === h)?.n ?? 0) }));
  const peak = hours.reduce((best, h) => (h.views > best.views ? h : best), { hour: null, views: 0 });
  const bestDay = series.reduce((best, d) => (d.views > best.views ? d : best), { day: null, views: 0 });

  const tableRows = byTable.filter((r) => r.table_label !== null).slice(0, 10).map((r) => ({ table: r.table_label, views: Number(r.n) }));
  const noTable = Number(byTable.find((r) => r.table_label === null)?.n ?? 0);

  return {
    days,
    totals: {
      views: total,
      visitors, // somme des visiteurs distincts de chaque jour (l'identifiant change chaque jour par respect de la vie privée)
      previousViews: previousTotal,
      avgPerDay: Math.round((total / days) * 10) / 10,
      peakHour: peak.views > 0 ? peak.hour : null,
      bestDay: bestDay.views > 0 ? bestDay : null,
    },
    series,
    hours,
    tables: tableRows,
    withoutTable: noTable,
  };
}
