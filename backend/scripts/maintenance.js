// Entretien périodique de la base (à lancer une fois par jour : `npm run maintenance`).
//  - supprime les consultations de menu de plus de 400 jours (la table grossit à chaque scan)
//  - supprime les jetons de réinitialisation expirés depuis plus de 7 jours
//  - passe en « expired » les abonnements dont la date de fin est dépassée (affichage cohérent dans les listes)
//  - supprime les journaux d'activité de plus de 400 jours
import { pool } from '../src/config/db.js';

const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY);

async function main() {
  const [views] = await pool.query('DELETE FROM menu_views WHERE viewed_at < ?', [ago(400)]);
  const [resets] = await pool.query('DELETE FROM password_resets WHERE expires_at < ?', [ago(7)]);
  const [subs] = await pool.query(`UPDATE subscriptions SET status = 'expired' WHERE status IN ('trial','active') AND ends_at <= ?`, [new Date()]);
  const [logs] = await pool.query('DELETE FROM activity_logs WHERE created_at < ?', [ago(400)]);
  console.log(`Entretien terminé : ${views.affectedRows} consultations, ${resets.affectedRows} jetons, ${logs.affectedRows} journaux supprimés ; ${subs.affectedRows} abonnement(s) marqué(s) expirés.`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
