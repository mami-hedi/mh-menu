import crypto from 'node:crypto';

const RESERVED = new Set([
  'admin', 'api', 'app', 'login', 'register', 'dashboard', 'r', 'www', 'static', 'assets',
  'demo', 'support', 'mhmenu', 'menu', 'superadmin', 'about', 'contact', 'pricing',
]);

export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Génère un slug libre : `base`, puis `base-2`, `base-3`... et enfin un suffixe aléatoire. */
export async function uniqueSlug(name, exists) {
  let base = slugify(name) || 'restaurant';
  if (RESERVED.has(base)) base = `${base}-resto`;
  if (!(await exists(base))) return base;
  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}
