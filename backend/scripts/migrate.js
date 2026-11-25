// Exécute les migrations SQL de /migrations dans l'ordre, une seule fois chacune.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(190) NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [done] = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map((r) => r.name));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = splitStatements(await fs.readFile(path.join(dir, file), 'utf8'));
    console.log(`> ${file} (${statements.length} instructions)`);
    for (const stmt of statements) await pool.query(stmt);
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    count++;
  }
  console.log(count ? `${count} migration(s) appliquée(s).` : 'Base déjà à jour.');
}

main()
  .catch((err) => {
    console.error('Échec de la migration :', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
