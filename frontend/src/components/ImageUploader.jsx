import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { optimizeImage } from '../lib/format.js';

export const MAX_IMAGE_MB = 5;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Vérifie côté navigateur (confort) : le serveur revérifie la signature réelle du fichier. */
export function validateImageFile(file) {
  if (!OK_TYPES.includes(file.type)) return 'Format non pris en charge. Utilisez JPEG, PNG ou WebP.';
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `Image trop lourde (${MAX_IMAGE_MB} Mo maximum).`;
  return null;
}

/**
 * Zone d'envoi d'une image unique (logo, couverture, catégorie).
 * onUpload(file) doit retourner une promesse ; les erreurs sont affichées sous la zone.
 */
export default function ImageUploader({ url, onUpload, onRemove, label, aspect = 'aspect-video', rounded = 'rounded-2xl', disabled, hint }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return setError(problem);
    setError('');
    setBusy(true);
    try { await onUpload(file); } catch (err) { setError(err.message || "Échec de l'envoi."); } finally { setBusy(false); }
  };

  const remove = async () => {
    setError('');
    setBusy(true);
    try { await onRemove(); } catch (err) { setError(err.message || 'Échec de la suppression.'); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold text-navy-800">{label}</div>
      <div className={`relative overflow-hidden border border-dashed border-navy-200 bg-navy-50 ${aspect} ${rounded}`}>
        {url ? (
          <img src={optimizeImage(url, 800)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={disabled || busy}
            className="grid h-full w-full place-items-center text-navy-500 hover:text-navy-600 disabled:opacity-60" aria-label={`Ajouter une image : ${label}`}>
            <span className="flex flex-col items-center gap-1.5 text-xs font-medium"><ImagePlus className="h-6 w-6" aria-hidden="true" /> Ajouter une image</span>
          </button>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-navy-500" aria-label="Envoi en cours" /></div>}
      </div>
      <input ref={input} type="file" accept={OK_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={pick} aria-hidden="true" />
      <div className="mt-2 flex items-center gap-3 text-sm">
        {url && (
          <>
            <button type="button" onClick={() => input.current?.click()} disabled={disabled || busy} className="font-semibold text-accent-700 hover:underline disabled:opacity-50">Remplacer</button>
            <button type="button" onClick={remove} disabled={disabled || busy} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Supprimer</button>
          </>
        )}
        {!url && hint && <span className="text-xs text-navy-500">{hint}</span>}
      </div>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
