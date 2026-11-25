import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v.trim();
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 caractères.');
}

// En production : refuse les valeurs d'exemple et les configurations dangereuses
if (isProd) {
  if (/change|example|secret|password|test/i.test(jwtSecret)) throw new Error('JWT_SECRET ressemble à une valeur d\'exemple : générez-en une aléatoire (openssl rand -hex 48).');
  if (!process.env.CLIENT_URL) throw new Error('CLIENT_URL est obligatoire en production (adresse https du frontend).');
  if (process.env.DB_SSL === 'false') console.warn('[config] DB_SSL=false en production : la connexion à la base n\'est pas chiffrée.');
}

const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (isProd && clientUrls.some((u) => !/^https:\/\//.test(u))) throw new Error('CLIENT_URL doit utiliser https en production.');

export const env = {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 4000,
  clientUrls,
  clientUrl: clientUrls[0],
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT) || 3306,
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
    ssl: (process.env.DB_SSL ?? 'true') !== 'false',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'MH Menu <no-reply@mhmenu.com>',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  trialDays: Number(process.env.TRIAL_DAYS) || 3,
};
