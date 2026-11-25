import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { HttpError } from '../utils/errors.js';

/**
 * Stockage d'images. Implémentation réelle : Cloudinary. Les tests injectent une implémentation simulée
 * avec setStorage(). Chaque restaurant a son propre dossier : mh-menu/r<restaurantId>/<type>.
 */
const cfg = env.cloudinary;
const configured = !!(cfg.cloudName && cfg.apiKey && cfg.apiSecret);
if (configured) cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });

export const folderFor = (restaurantId, type) => `mh-menu/r${restaurantId}/${type}`;
/** Une image n'est supprimable que si elle est dans le dossier du restaurant concerné. */
export const ownsPublicId = (restaurantId, publicId) => typeof publicId === 'string' && publicId.startsWith(`mh-menu/r${restaurantId}/`);

const cloudinaryStorage = {
  configured,
  upload(buffer, { folder }) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          // Limite la taille stockée : l'original très volumineux n'est pas conservé tel quel
          transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        },
        (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id }))
      );
      stream.end(buffer);
    });
  },
  async destroy(publicId) {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  },
  async copy(url, { folder }) {
    const r = await cloudinary.uploader.upload(url, { folder, resource_type: 'image' });
    return { url: r.secure_url, publicId: r.public_id };
  },
};

let impl = cloudinaryStorage;
export const setStorage = (fake) => { impl = fake; };

export const storage = {
  get configured() { return impl.configured; },
  upload: (buffer, opts) => impl.upload(buffer, opts),
  destroy: (id) => impl.destroy(id),
  copy: (url, opts) => impl.copy(url, opts),
};

/** Supprime des images en tâche de fond : un échec ne doit jamais faire échouer la requête. */
export async function destroyOwned(restaurantId, publicIds) {
  await Promise.all(
    publicIds
      .filter((id) => ownsPublicId(restaurantId, id))
      .map((id) => storage.destroy(id).catch((e) => console.error('[storage] suppression échouée :', id, e.message)))
  );
}

export function assertStorage() {
  if (!storage.configured) {
    throw new HttpError(503, "Le stockage d'images n'est pas configuré. Contactez l'administrateur.", 'STORAGE_NOT_CONFIGURED');
  }
}
