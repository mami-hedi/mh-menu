import { env } from './config/env.js';
import { pool } from './config/db.js';
import { createApp } from './app.js';

const app = createApp();
const server = app.listen(env.port, () => {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) console.warn('[images] Cloudinary non configuré : le téléversement d’images est désactivé. Renseignez CLOUDINARY_* dans .env puis lancez `npm run check:cloudinary`.');
  console.log(`MH Menu API démarrée sur le port ${env.port} (${env.isProd ? 'production' : 'développement'})`);
});

async function shutdown(signal) {
  console.log(`${signal} reçu : arrêt en cours...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  shutdown('uncaughtException');
});
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
