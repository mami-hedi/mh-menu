import multer from 'multer';
import { badRequest, asyncHandler } from '../utils/errors.js';
import { assertStorage } from '../services/storage.js';

const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 6;

const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: MAX_PRODUCT_IMAGES, fields: 5 } });

/** On ne fait pas confiance au type MIME ni à l'extension : on vérifie la signature binaire (JPEG, PNG, WebP). */
function detectImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function checkFiles(req, _res, next) {
  const files = req.files ?? (req.file ? [req.file] : []);
  if (files.length === 0) return next(badRequest('Aucun fichier reçu.'));
  for (const f of files) {
    if (!detectImage(f.buffer)) return next(badRequest('Format non pris en charge. Utilisez une image JPEG, PNG ou WebP.'));
  }
  next();
}

const storageReady = asyncHandler(async (_req, _res, next) => {
  assertStorage();
  next();
});

export const uploadSingle = (field = 'image') => [storageReady, memory.single(field), checkFiles];
export const uploadMany = (field = 'images') => [storageReady, memory.array(field, MAX_PRODUCT_IMAGES), checkFiles];
