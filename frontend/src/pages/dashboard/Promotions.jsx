import { useState } from 'react';
import { BadgePercent } from 'lucide-react';
import { Alert, Button, Card, Input, Spinner } from '../../components/ui.jsx';
import Toggle from '../../components/Toggle.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite, WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDT, parsePrice } from '../../lib/format.js';
import { FilterBar, useCatalog } from './Products.jsx';

function PromoRow({ product, onSaved }) {
  const toast = useToast();
  const canWrite = useCanWrite();
  const [isPromo, setIsPromo] = useState(product.isPromo);
  const [promo, setPromo] = useState(product.promoPrice != null ? String(product.promoPrice) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const dirty = isPromo !== product.isPromo || (promo.trim() === '' ? null : promo.trim().replace(',', '.')) !== (product.promoPrice != null ? String(product.promoPrice) : null);

  const save = async () => {
    setError('');
    const value = promo.trim() === '' ? null : parsePrice(promo);
    if (promo.trim() !== '' && value === null) return setError('Prix invalide.');
    if (isPromo && value === null) return setError('Indiquez le prix promotionnel.');
    if (value !== null && !(value < product.price)) return setError(`Doit être inférieur à ${formatDT(product.price)}.`);
    setSaving(true);
    try {
      const { data } = await api.patch(`/restaurant/products/${product.id}`, { isPromo, promoPrice: value });
      onSaved(data);
      toast.success(isPromo ? 'Promotion enregistrée.' : 'Promotion désactivée.');
    } catch (e) { setError(parseError(e).message); } finally { setSaving(false); }
  };

  return (
    <li className="flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-0 flex-1 basis-48">
        <div className="truncate font-bold">{product.name}</div>
        <div className="text-sm text-navy-500">{product.categoryName} · prix normal {formatDT(product.price)}</div>
      </div>
      <label className="flex items-center gap-2 pt-2 text-sm font-medium text-navy-600">
        <Toggle size="sm" checked={isPromo} onChange={setIsPromo} label={`Promotion sur ${product.name}`} disabled={!canWrite} /> En promotion
      </label>
      <div className="w-36">
        <Input aria-label={`Prix promotionnel de ${product.name} (DT)`} inputMode="decimal" placeholder="Prix promo" value={promo} onChange={(e) => setPromo(e.target.value)} invalid={!!error} disabled={!canWrite} />
        {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      </div>
      <Button size="sm" onClick={save} loading={saving} disabled={!dirty || !canWrite}>Enregistrer</Button>
    </li>
  );
}

export default function Promotions() {
  usePageMeta('Promotions – MH Menu');
  const { categories, products, setProducts, filters, setFilters, error } = useCatalog();

  if (error && !categories) return <Alert>{error}</Alert>;
  if (!categories) return <Spinner />;
  const activePromos = products?.filter((p) => p.isPromo).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Promotions</h1>
        <p className="mt-1 text-navy-500">Activez une promotion et fixez le prix promotionnel : il s'affiche à côté du prix barré sur votre menu.</p>
      </div>
      <WriteBlockedNotice />
      <FilterBar categories={categories} filters={filters} setFilters={setFilters} />
      {error && <Alert>{error}</Alert>}
      {!products && !error && <Spinner />}
      {products && products.length === 0 && <Card className="p-10 text-center text-navy-500">Aucun produit à afficher.</Card>}
      {products && products.length > 0 && (
        <>
          <p className="flex items-center gap-2 text-sm text-navy-500"><BadgePercent className="h-4 w-4 text-accent-700" aria-hidden="true" /> {activePromos} promotion{activePromos > 1 ? 's' : ''} active{activePromos > 1 ? 's' : ''} dans cette liste</p>
          <Card>
            <ul className="divide-y divide-navy-100">
              {products.map((p) => (
                <PromoRow key={`${p.id}-${p.isPromo}-${p.promoPrice}`} product={p} onSaved={(data) => setProducts((cur) => cur.map((x) => (x.id === data.id ? { ...x, ...data } : x)))} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
