import { HttpError } from '../utils/errors.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Route introuvable : ${req.method} ${req.path}`, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  // JSON mal formé ou corps trop volumineux (body-parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Corps de requête JSON invalide.' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Requête trop volumineuse.' } });
  }
  // Erreurs d'upload (taille, nombre de fichiers...)
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (5 Mo maximum).' : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Trop de fichiers envoyés.' : 'Fichier invalide.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { code: 'UPLOAD_ERROR', message: msg } });
  }
  // Violation d'unicité non gérée par le service
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Cet élément existe déjà.' } });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: env.isProd ? 'Erreur interne du serveur.' : err.message },
  });
}
