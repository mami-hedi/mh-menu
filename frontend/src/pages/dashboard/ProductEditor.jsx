import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Field, Input, Spinner } from '../../components/ui.jsx';
import { Modal } from '../../components/Modal.jsx';
import Toggle from '../../components/Toggle.jsx';
import { validateImageFile } from '../../components/ImageUploader.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite } from '../../components/WriteGuard.jsx';
import { api, parseError } from '../../services/api.js';
import { optimizeImage, parsePrice, priceRule } from '../../lib/format.js';

const MAX_PHOTOS = 6;
const TABS = [['general', 'Général'], ['photos', 'Photos'], ['variants', 'Variantes'], ['extras', 'Suppléments']];

const toForm = (p, categories) => ({
  categoryId: String(p?.categoryId ?? categories[0]?.id ?? ''),
  name: p?.name ?? '',
  description: p?.description ?? '',
  price: p ? String(p.price) : '',
  isPromo: p?.isPromo ?? false,
  promoPrice: p?.promoPrice != null ? String(p.promoPrice) : '',
  isAvailable: p?.isAvailable ?? true,
  isActive: p?.isActive ?? true,
  isPopular: p?.isPopular ?? false,
  variants: (p?.variants ?? []).map((v) => ({ name: v.name, priceDelta: String(v.priceDelta), isDefault: v.isDefault })),
  extras: (p?.extras ?? []).map((e) => ({ name: e.name, price: String(e.price), isRequired: e.isRequired })),
});

function SwitchRow({ label, hint, control, name, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 px-4 py-3">
      <div><div className="text-sm font-semibold">{label}</div>{hint && <div className="text-xs text-navy-500">{hint}</div>}</div>
      <Controller control={control} name={name} render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={label} disabled={disabled} />} />
    </div>
  );
}

function PhotosTab({ product, onChange, disabled }) {
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const images = product.images;

  const upload = async (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    if (images.length + files.length > MAX_PHOTOS) return setError(`${MAX_PHOTOS} photos maximum par produit.`);
    const bad = files.map(validateImageFile).find(Boolean);
    if (bad) return setError(bad);
    setError(''); setBusy(true);
    try {
      const f = new FormData();
      files.forEach((file) => f.append('images', file));
      const { data } = await api.post(`/restaurant/products/${product.id}/images`, f);
      onChange(data);
    } catch (err) { setError(parseError(err).message); } finally { setBusy(false); }
  };

  const remove = async (img) => {
    setBusy(true); setError('');
    try { const { data } = await api.delete(`/restaurant/products/${product.id}/images/${img.id}`); onChange(data); }
    catch (err) { setError(parseError(err).message); } finally { setBusy(false); }
  };

  const move = async (i, delta) => {
    const ids = images.map((x) => x.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true); setError('');
    try { const { data } = await api.put(`/restaurant/products/${product.id}/images/reorder`, { ids }); onChange(data); toast.success('Ordre des photos mis à jour.'); }
    catch (err) { setError(parseError(err).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-500">La première photo sert d'image principale. {MAX_PHOTOS} photos maximum, 5 Mo chacune (JPEG, PNG ou WebP).</p>
      {error && <Alert>{error}</Alert>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.id} className="overflow-hidden rounded-2xl border border-navy-100">
            <div className="relative aspect-square bg-navy-50">
              <img src={optimizeImage(img.url, 400)} alt={`Photo ${i + 1} de ${product.name}`} className="h-full w-full object-cover" loading="lazy" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-navy-900 px-2 py-0.5 text-[10px] font-bold text-white">Principale</span>}
            </div>
            <div className="flex items-center justify-between p-1.5">
              <div className="flex">
                <button type="button" disabled={i === 0 || busy || disabled} onClick={() => move(i, -1)} className="rounded p-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-30" aria-label={`Déplacer la photo ${i + 1} vers la gauche`}><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" disabled={i === images.length - 1 || busy || disabled} onClick={() => move(i, 1)} className="rounded p-1.5 text-navy-500 hover:bg-navy-50 disabled:opacity-30" aria-label={`Déplacer la photo ${i + 1} vers la droite`}><ArrowRight className="h-4 w-4" /></button>
              </div>
              <button type="button" disabled={busy || disabled} onClick={() => remove(img)} className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40" aria-label={`Supprimer la photo ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {images.length < MAX_PHOTOS && (
          <li>
            <button type="button" onClick={() => input.current?.click()} disabled={busy || disabled}
              className="grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed border-navy-200 text-navy-500 hover:border-accent-500 hover:text-accent-700 disabled:opacity-50">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-label="Envoi en cours" /> : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="h-6 w-6" aria-hidden="true" /> Ajouter des photos</span>}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={upload} />
    </div>
  );
}

/**
 * Éditeur complet d'un produit (création ou modification).
 * Les photos s'enregistrent immédiatement (le produit doit exister) ; le reste via « Enregistrer ».
 */
export default function ProductEditor({ productId, categories, initialTab = 'general', onClose, onSaved }) {
  const toast = useToast();
  const canWrite = useCanWrite();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(!!productId);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState(initialTab);
  const [serverError, setServerError] = useState('');

  const { register, control, handleSubmit, reset, setError, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: toForm(null, categories) });
  const variants = useFieldArray({ control, name: 'variants' });
  const extras = useFieldArray({ control, name: 'extras' });
  const isPromo = watch('isPromo');

  useEffect(() => {
    if (!productId) return;
    let live = true;
    api.get(`/restaurant/products/${productId}`)
      .then(({ data }) => { if (live) { setProduct(data); reset(toForm(data, categories)); } })
      .catch((e) => live && setLoadError(parseError(e).message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [productId, categories, reset]);

  const onSubmit = async (v) => {
    setServerError('');
    const price = parsePrice(v.price);
    const promoPrice = v.promoPrice.trim() === '' ? null : parsePrice(v.promoPrice);
    if (v.isPromo && promoPrice == null) { setTab('general'); return setError('promoPrice', { message: 'Prix promotionnel requis.' }); }
    if (promoPrice != null && !(promoPrice < price)) { setTab('general'); return setError('promoPrice', { message: 'Doit être inférieur au prix normal.' }); }
    const names = v.variants.map((x) => x.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { setTab('variants'); return setServerError('Les noms des variantes doivent être uniques.'); }
    const exNames = v.extras.map((x) => x.name.trim().toLowerCase());
    if (new Set(exNames).size !== exNames.length) { setTab('extras'); return setServerError('Les noms des suppléments doivent être uniques.'); }

    const body = {
      categoryId: Number(v.categoryId), name: v.name.trim(), description: v.description.trim(), price, promoPrice,
      isPromo: v.isPromo, isAvailable: v.isAvailable, isActive: v.isActive, isPopular: v.isPopular,
      variants: v.variants.map((x) => ({ name: x.name.trim(), priceDelta: parsePrice(x.priceDelta), isDefault: !!x.isDefault })),
      extras: v.extras.map((x) => ({ name: x.name.trim(), price: parsePrice(x.price), isRequired: !!x.isRequired })),
    };
    try {
      const { data } = product ? await api.patch(`/restaurant/products/${product.id}`, body) : await api.post('/restaurant/products', body);
      if (product) {
        toast.success('Produit enregistré.');
        onSaved(data, false);
        onClose();
      } else {
        // Création : on reste ouvert pour proposer l'ajout de photos
        setProduct(data); reset(toForm(data, categories)); setTab('photos');
        toast.success('Produit créé. Ajoutez maintenant des photos.');
        onSaved(data, true);
      }
    } catch (err) {
      const p = parseError(err);
      const f = p.fields ?? {};
      if (f.promoPrice || f.price || f.categoryId || f.name) {
        setTab('general');
        for (const k of ['price', 'promoPrice', 'categoryId', 'name']) if (f[k]) setError(k, { message: f[k] });
      } else if (f.variants) setTab('variants');
      else if (f.extras) setTab('extras');
      setServerError(p.message);
    }
  };

  const setDefaultVariant = (index) => variants.fields.forEach((_, j) => setValue(`variants.${j}.isDefault`, j === index, { shouldDirty: true }));
  const nameRule = (label, max) => ({ required: `${label} requis.`, maxLength: { value: max, message: `${max} caractères maximum.` }, validate: (v) => v.trim() !== '' || `${label} requis.` });
  const onInvalid = (errs) => {
    if (errs.name || errs.price || errs.promoPrice || errs.categoryId) setTab('general');
    else if (errs.variants) setTab('variants');
    else if (errs.extras) setTab('extras');
  };

  return (
    <Modal title={product ? `Modifier « ${product.name} »` : 'Nouveau produit'} onClose={onClose} size="lg">
      {loading ? <Spinner /> : loadError ? <div className="p-6"><Alert>{loadError}</Alert></div> : (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div role="tablist" aria-label="Sections du produit" className="flex gap-1 overflow-x-auto border-b border-navy-100 px-4 sm:px-6">
            {TABS.map(([id, label]) => {
              const disabled = id === 'photos' && !product;
              const count = id === 'variants' ? variants.fields.length : id === 'extras' ? extras.fields.length : id === 'photos' ? product?.images.length : 0;
              return (
                <button key={id} type="button" role="tab" aria-selected={tab === id} disabled={disabled} title={disabled ? "Enregistrez d'abord le produit" : undefined}
                  onClick={() => setTab(id)}
                  className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tab === id ? 'border-accent-500 text-navy-900' : 'border-transparent text-navy-500 hover:text-navy-700'}`}>
                  {label}{count ? <span className="ml-1.5 rounded-full bg-navy-100 px-1.5 py-0.5 text-[11px]">{count}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {serverError && <Alert>{serverError}</Alert>}

            <div hidden={tab !== 'general'} className="space-y-4">
              <Field label="Nom du produit" htmlFor="p-name" error={errors.name?.message}>
                <Input id="p-name" data-autofocus placeholder="Pizza Margherita" invalid={!!errors.name} {...register('name', nameRule('Nom', 150))} />
              </Field>
              <Field label="Catégorie" htmlFor="p-cat" error={errors.categoryId?.message}>
                <select id="p-cat" className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15" {...register('categoryId', { required: 'Catégorie requise.' })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Description (facultatif)" htmlFor="p-desc" error={errors.description?.message}>
                <textarea id="p-desc" rows={3} className="w-full rounded-xl border border-navy-200 px-4 py-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15" placeholder="Tomate, mozzarella, basilic frais…" {...register('description', { maxLength: { value: 2000, message: '2000 caractères maximum.' } })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prix (DT)" htmlFor="p-price" error={errors.price?.message}>
                  <Input id="p-price" inputMode="decimal" placeholder="12" invalid={!!errors.price} {...register('price', priceRule(true))} />
                </Field>
                <Field label="Prix promotionnel (DT)" htmlFor="p-promo" error={errors.promoPrice?.message} hint={isPromo ? undefined : 'Active la promotion ci-dessous pour l\'afficher.'}>
                  <Input id="p-promo" inputMode="decimal" placeholder="10" invalid={!!errors.promoPrice} {...register('promoPrice', priceRule(false))} />
                </Field>
              </div>
              <div className="space-y-2.5">
                <SwitchRow control={control} name="isPromo" label="Produit en promotion" hint="Affiche le prix promotionnel barré à côté du prix normal." disabled={!canWrite} />
                <SwitchRow control={control} name="isAvailable" label="Disponible" hint="Désactivez pour signaler un produit épuisé." disabled={!canWrite} />
                <SwitchRow control={control} name="isPopular" label="Produit populaire" hint="Mis en avant dans « Produits populaires »." disabled={!canWrite} />
                <SwitchRow control={control} name="isActive" label="Actif" hint="Un produit inactif est masqué du menu." disabled={!canWrite} />
              </div>
            </div>

            {tab === 'photos' && product && <PhotosTab product={product} disabled={!canWrite} onChange={(p) => { setProduct((cur) => ({ ...cur, images: p.images })); onSaved(p, false, true); }} />}

            <div hidden={tab !== 'variants'} className="space-y-3">
              <p className="text-sm text-navy-500">Tailles ou formules (Petite / Moyenne / Grande, Simple / Double…). Le montant s'<strong>ajoute</strong> au prix de base ; la variante par défaut est présélectionnée.</p>
              {variants.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-xl border border-navy-100 p-3 sm:grid-cols-[auto_1fr_9rem_auto]">
                  <label className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-navy-500">
                    <input type="radio" name="default-variant" checked={!!watch(`variants.${i}.isDefault`)} onChange={() => setDefaultVariant(i)} className="accent-accent-600" aria-label={`Variante par défaut : ${watch(`variants.${i}.name`) || i + 1}`} /> Défaut
                  </label>
                  <Field label="" htmlFor={`v-name-${i}`} error={errors.variants?.[i]?.name?.message}>
                    <Input id={`v-name-${i}`} aria-label={`Nom de la variante ${i + 1}`} placeholder="Grande" invalid={!!errors.variants?.[i]?.name} {...register(`variants.${i}.name`, nameRule('Nom', 80))} />
                  </Field>
                  <div className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto">
                    <Field label="" htmlFor={`v-delta-${i}`} error={errors.variants?.[i]?.priceDelta?.message}>
                      <Input id={`v-delta-${i}`} aria-label={`Supplément de prix de la variante ${i + 1}`} inputMode="decimal" placeholder="+ 0 DT" invalid={!!errors.variants?.[i]?.priceDelta} {...register(`variants.${i}.priceDelta`, priceRule(true))} />
                    </Field>
                  </div>
                  <button type="button" onClick={() => variants.remove(i)} className="mt-1.5 rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Supprimer la variante ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {variants.fields.length < 10 && (
                <Button type="button" variant="secondary" size="sm" onClick={() => variants.append({ name: '', priceDelta: '0', isDefault: variants.fields.length === 0 })}><Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une variante</Button>
              )}
            </div>

            <div hidden={tab !== 'extras'} className="space-y-3">
              <p className="text-sm text-navy-500">Suppléments et options. Marquez « Obligatoire » une option que le client doit choisir.</p>
              {extras.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-xl border border-navy-100 p-3 sm:grid-cols-[1fr_9rem_auto_auto]">
                  <Field label="" htmlFor={`e-name-${i}`} error={errors.extras?.[i]?.name?.message}>
                    <Input id={`e-name-${i}`} aria-label={`Nom du supplément ${i + 1}`} placeholder="Fromage supplémentaire" invalid={!!errors.extras?.[i]?.name} {...register(`extras.${i}.name`, nameRule('Nom', 80))} />
                  </Field>
                  <button type="button" onClick={() => extras.remove(i)} className="mt-1.5 rounded-lg p-2 text-red-500 hover:bg-red-50 sm:order-last" aria-label={`Supprimer le supplément ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                  <Field label="" htmlFor={`e-price-${i}`} error={errors.extras?.[i]?.price?.message}>
                    <Input id={`e-price-${i}`} aria-label={`Prix du supplément ${i + 1}`} inputMode="decimal" placeholder="+ 2 DT" invalid={!!errors.extras?.[i]?.price} {...register(`extras.${i}.price`, priceRule(true))} />
                  </Field>
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium text-navy-600"><input type="checkbox" className="accent-accent-600" {...register(`extras.${i}.isRequired`)} /> Obligatoire</label>
                </div>
              ))}
              {extras.fields.length < 30 && (
                <Button type="button" variant="secondary" size="sm" onClick={() => extras.append({ name: '', price: '0', isRequired: false })}><Plus className="h-4 w-4" aria-hidden="true" /> Ajouter un supplément</Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-navy-100 px-5 py-4 sm:px-6">
            <span className="text-xs text-navy-500">{tab === 'photos' ? 'Les photos sont enregistrées immédiatement.' : ''}</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Fermer</Button>
              {tab !== 'photos' && <Button type="submit" loading={isSubmitting} disabled={!canWrite}>{product ? 'Enregistrer' : 'Créer le produit'}</Button>}
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
