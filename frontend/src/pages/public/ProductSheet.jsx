import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { unitPrice } from './cart.js';
import { formatDT, optimizeImage } from '../../lib/format.js';

export function Price({ product, className = '' }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="font-extrabold">{formatDT(product.finalPrice)}</span>
      {product.promoPrice != null && <span className="ml-1.5 text-xs text-neutral-500 line-through">{formatDT(product.price)}</span>}
      {product.variants.length > 0 && <span className="ml-1 text-xs font-medium text-neutral-500">et +</span>}
    </span>
  );
}

export default function ProductSheet({ product, cartEnabled, brand, onClose, onAdd }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [variantId, setVariantId] = useState(() => (product.variants.find((v) => v.isDefault) ?? product.variants[0])?.id ?? null);
  const [extraIds, setExtraIds] = useState(() => product.extras.filter((e) => e.isRequired).map((e) => e.id));
  const [qty, setQty] = useState(1);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const chosen = product.extras.filter((e) => extraIds.includes(e.id));
  const unit = unitPrice(product, variant, chosen);
  const canAdd = cartEnabled && product.isAvailable;
  const toggle = (e) => !e.isRequired && setExtraIds((ids) => (ids.includes(e.id) ? ids.filter((x) => x !== e.id) : [...ids, e.id]));

  return (
    <Sheet
      title={product.name}
      onClose={onClose}
      footer={canAdd ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
            <button type="button" aria-label="Diminuer la quantité" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-100 disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden="true" /></button>
            <span className="w-7 text-center font-bold" aria-live="polite">{qty}</span>
            <button type="button" aria-label="Augmenter la quantité" disabled={qty >= 99} onClick={() => setQty((q) => q + 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-neutral-100 disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <button type="button" onClick={() => onAdd(product.id, variantId, extraIds, qty)} style={{ background: brand.bg, color: brand.fg }} className="flex-1 rounded-full px-5 py-3 text-sm font-bold shadow-sm active:opacity-90">
            Ajouter · {formatDT(unit * qty)}
          </button>
        </div>
      ) : null}
    >
      {product.images.length > 0 && (
        <div>
          <img src={optimizeImage(product.images[imgIdx], 900)} alt={product.name} className="aspect-[4/3] w-full object-cover" />
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-5 pt-3">
              {product.images.map((u, i) => (
                <button key={u} type="button" onClick={() => setImgIdx(i)} aria-label={`Photo ${i + 1}`} aria-current={i === imgIdx} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? 'border-neutral-900' : 'border-transparent opacity-70'}`}>
                  <img src={optimizeImage(u, 120)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-5 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">{product.description || ' '}</p>
          <Price product={product} className="shrink-0 text-base" />
        </div>
        {!product.isAvailable && <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-600">Ce produit est momentanément indisponible.</p>}

        {product.variants.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Taille / choix</legend>
            <div className="space-y-2">
              {product.variants.map((v) => (
                <label key={v.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${variantId === v.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="variant" className="h-4 w-4 accent-neutral-900" checked={variantId === v.id} onChange={() => setVariantId(v.id)} />
                    <span className="font-medium">{v.name}</span>
                  </span>
                  <span className="text-neutral-500">{Number(v.priceDelta) ? `${Number(v.priceDelta) > 0 ? '+' : '−'} ${formatDT(Math.abs(v.priceDelta))}` : 'Inclus'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {product.extras.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Suppléments</legend>
            <div className="space-y-2">
              {product.extras.map((e) => {
                const on = extraIds.includes(e.id);
                return (
                  <label key={e.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${e.isRequired ? 'cursor-default' : 'cursor-pointer'} ${on ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'}`}>
                    <span className="flex items-center gap-3">
                      <input type="checkbox" className="h-4 w-4 accent-neutral-900" checked={on} disabled={e.isRequired} onChange={() => toggle(e)} />
                      <span className="font-medium">{e.name}</span>
                      {e.isRequired && <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><Check className="h-3 w-3" aria-hidden="true" /> inclus</span>}
                    </span>
                    <span className="text-neutral-500">{Number(e.price) ? `+ ${formatDT(e.price)}` : 'Gratuit'}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>
    </Sheet>
  );
}
