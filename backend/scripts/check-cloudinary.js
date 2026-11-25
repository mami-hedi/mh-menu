// Vérifie la configuration Cloudinary : `npm run check:cloudinary`
// Envoie une image de test (1 pixel), l'affiche à l'adresse retournée, puis la supprime.
import { env } from '../src/config/env.js';
import { storage } from '../src/services/storage.js';

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const missing = Object.entries({ CLOUDINARY_CLOUD_NAME: env.cloudinary.cloudName, CLOUDINARY_API_KEY: env.cloudinary.apiKey, CLOUDINARY_API_SECRET: env.cloudinary.apiSecret })
  .filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.error(`✗ Variables manquantes dans backend/.env : ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`Cloud name : ${env.cloudinary.cloudName}`);
try {
  const r = await storage.upload(PIXEL, { folder: 'mh-menu/diagnostic' });
  console.log('✓ Envoi réussi :', r.url);
  const head = await fetch(r.url, { method: 'HEAD' });
  console.log(head.ok ? '✓ Image accessible publiquement (HTTP ' + head.status + ')' : '✗ Image envoyée mais inaccessible (HTTP ' + head.status + ')');
  await storage.destroy(r.publicId);
  console.log('✓ Image de test supprimée. Cloudinary est prêt.');
} catch (e) {
  const msg = e?.message || String(e);
  console.error('✗ Échec :', msg);
  if (/api_key|Invalid|401|Unauthorized/i.test(msg)) console.error('  → Vérifiez CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET (copiez-les depuis le tableau de bord, sans espace).');
  if (/cloud_name|404|Not Found/i.test(msg)) console.error('  → Vérifiez CLOUDINARY_CLOUD_NAME (nom exact affiché dans le tableau de bord).');
  process.exit(1);
}
