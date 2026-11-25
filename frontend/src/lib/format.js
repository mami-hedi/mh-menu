export const formatDT = (n) =>
  `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 3 })} DT`;

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const formatShortDay = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

export const publicMenuUrl = (slug) => `${window.location.origin}/r/${slug}`;

/** Images Cloudinary : demande un format et une qualité automatiques et une largeur adaptée (chargement plus rapide). */
export const optimizeImage = (url, width = 600) =>
  url && url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/f_auto')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`)
    : url;

/** Lit un prix saisi (virgule ou point). Retourne null si invalide. */
export const parsePrice = (value) => {
  const n = Number(String(value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 ? n : null;
};

/** Règle react-hook-form pour un champ prix. */
export const priceRule = (required = true) => ({
  validate: (v) => {
    if (String(v ?? '').trim() === '') return required ? 'Prix requis.' : true;
    return parsePrice(v) !== null || 'Prix invalide (3 décimales maximum).';
  },
});
