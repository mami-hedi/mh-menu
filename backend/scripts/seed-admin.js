// Crée (ou met à jour le mot de passe de) le Super Admin à partir des variables d'environnement.
// Aucun mot de passe n'est écrit dans le code ni dans les migrations.
import bcrypt from 'bcrypt';
import { pool } from '../src/config/db.js';

const name = process.env.SUPERADMIN_NAME || 'MH Digital Solution';
const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD || '';

async function main() {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('SUPERADMIN_EMAIL manquant ou invalide.');
  if (password.length < 12 || password.length > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('SUPERADMIN_PASSWORD : 12 à 72 caractères avec majuscule, minuscule et chiffre.');
  }

  const hash = await bcrypt.hash(password, 12);
  const [rows] = await pool.query('SELECT id, role FROM users WHERE email = ?', [email]);

  if (rows.length) {
    if (rows[0].role !== 'super_admin') throw new Error('Cet email appartient déjà à un compte restaurant.');
    await pool.query('UPDATE users SET password_hash = ?, name = ?, is_active = 1, token_version = token_version + 1 WHERE id = ?', [hash, name, rows[0].id]);
    console.log(`Super Admin mis à jour : ${email}`);
  } else {
    await pool.query(`INSERT INTO users (restaurant_id, name, email, password_hash, role) VALUES (NULL, ?, ?, ?, 'super_admin')`, [name, email, hash]);
    console.log(`Super Admin créé : ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
