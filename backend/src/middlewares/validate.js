import { badRequest } from '../utils/errors.js';

/** Valide et remplace req[source] par la version nettoyée (champs inconnus retirés par zod). */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      return next(badRequest('Données invalides.', fields));
    }
    // Express 5 : req.query est un getter, on le redéfinit proprement
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true, enumerable: true });
    next();
  };
