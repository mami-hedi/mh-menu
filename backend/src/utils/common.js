import { z } from 'zod';

export const id = z.coerce.number().int().positive();
export const idParams = z.object({ id });
export const idAndChild = (child) => z.object({ id, [child]: id });

/** Prix en DT : positif, 3 décimales maximum (millimes). */
export const money = z
  .number('Montant invalide.')
  .min(0, 'Le montant ne peut pas être négatif.')
  .max(100000, 'Montant trop élevé.')
  .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, 'Maximum 3 décimales.');

/** Texte optionnel : chaîne vide → null. */
export const optionalText = (max) =>
  z.string().trim().max(max, `${max} caractères maximum.`).nullish().transform((v) => (v ? v : null));

export const reorderBody = z.object({ ids: z.array(id).min(1).max(500) });

export const bool = z.boolean();

/** Construit un UPDATE partiel à partir d'une liste blanche { cléApi: colonneSQL } (jamais de colonne issue du client). */
export function buildUpdate(map, data) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (data[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(typeof data[key] === 'boolean' ? Number(data[key]) : data[key]);
  }
  return { sets, params };
}

/** MySQL/TiDB renvoient les colonnes JSON déjà décodées, MariaDB les renvoie en texte. */
export function parseJson(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v;
}
