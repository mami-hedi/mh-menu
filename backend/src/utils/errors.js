export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg = 'Requête invalide.', details) => new HttpError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'Authentification requise.') => new HttpError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Accès refusé.', code = 'FORBIDDEN') => new HttpError(403, msg, code);
export const notFound = (msg = 'Ressource introuvable.') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg = 'Conflit.') => new HttpError(409, msg, 'CONFLICT');

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
